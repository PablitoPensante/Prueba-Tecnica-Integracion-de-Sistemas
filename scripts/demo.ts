import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { Server as SocketServer } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { db, pool } from "../src/db/client.js";
import { webhookDeliveries, webhookEvents } from "../src/db/schema.js";
import { env } from "../src/config/env.js";
import { createSystemAApp } from "../src/system-a/app.js";
import { createSystemBApp } from "../src/system-b/app.js";
import { DrizzleDocumentRepository } from "../src/system-a/drizzle-document-repository.js";
import { FetchSystemBClient } from "../src/system-a/system-b-client.js";
import { FileSigningRequestStore } from "../src/system-b/signing-request-store.js";
import { DrizzleDeliveryAuditRepository } from "../src/system-b/delivery-audit-repository.js";
import { FetchWebhookDelivery } from "../src/system-b/webhook-delivery.js";
import { configureSocketRooms, SocketIntegrationEvents } from "../src/realtime/socket-integration-events.js";
import { createSignedWebhook } from "../src/shared/webhook-signature.js";

const servers: Server[] = [];
const ids: string[] = [];
const repository = new DrizzleDocumentRepository(db);
let socketServer: SocketServer | undefined;
let socket: Socket | undefined;
let directory: string | undefined;

async function listen(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function request(url: string, body: unknown, expected: number, headers = {}) {
  const response = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}

try {
  console.log("Aplicando migraciones en PostgreSQL…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  directory = await mkdtemp(join(tmpdir(), "absign-demo-"));
  const store = new FileSigningRequestStore(join(directory, "requests.json"));
  const bUrl = await listen(createServer(createSystemBApp({
    signingRequestStore: store,
    deliveryAuditRepository: new DrizzleDeliveryAuditRepository(db),
    webhookDelivery: new FetchWebhookDelivery({ hmacSecret: env.HMAC_SECRET, timeoutMs: 1000, maxAttempts: 3, baseDelayMs: 10 }),
  })));
  let app: ReturnType<typeof createSystemAApp>;
  const aServer = createServer((req, res) => app(req, res));
  socketServer = new SocketServer(aServer);
  configureSocketRooms(socketServer, env.ADMIN_SOCKET_TOKEN);
  const aUrl = await listen(aServer);
  app = createSystemAApp({ repository, systemBClient: new FetchSystemBClient({ baseUrl: bUrl, timeoutMs: 1000 }), callbackUrl: `${aUrl}/webhooks/absign`, events: new SocketIntegrationEvents(socketServer) });
  socket = connect(aUrl, { transports: ["websocket"], reconnection: false, timeout: 5000 });
  await new Promise<void>((resolve, reject) => {
    socket!.once("connect", resolve);
    socket!.once("connect_error", reject);
  });

  for (const status of ["approved", "rejected"] as const) {
    const created = await request(`${aUrl}/documents`, { subject: `Demo ${status}`, thirdPartyEmail: "demo@example.com", fileUrl: "https://example.com/demo.pdf" }, 201);
    ids.push(created.id);
    assert.equal(created.status, "sent");
    await socket.timeout(5000).emitWithAck("document:subscribe", created.id).then((accepted) => assert.equal(accepted, true));
    // Register before requesting the decision: delivery is synchronous on System B.
    let timer: ReturnType<typeof setTimeout>;
    const changed = new Promise<Record<string, unknown>>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("No se recibió el evento Socket.IO")), 5000);
      socket!.once("document:statusChanged", resolve);
    });
    // Attach immediately so timeout failures cannot become unhandled rejections.
    const [decision, event] = await Promise.all([
      request(`${bUrl}/documents/${created.id}/decision`, { status, ...(status === "rejected" ? { reason: "Falta información" } : {}) }, 200),
      changed,
    ]).finally(() => clearTimeout(timer));
    assert.equal(decision.webhook.delivered, true);
    assert.equal(event.id, created.id);
    assert.equal(event.status, status);
    assert.equal((await repository.findById(created.id))?.status, status);
    const payload = createSignedWebhook({ documentId: created.id, status, timestamp: new Date().toISOString() }, env.HMAC_SECRET);
    const duplicate = await request(`${aUrl}/webhooks/absign`, payload, 200, { "x-signature": payload.signature });
    assert.equal(duplicate.duplicate, true);
    await request(`${aUrl}/webhooks/absign`, payload, 401, { "x-signature": "0".repeat(64) });
    const events = await db.select().from(webhookEvents).where(eq(webhookEvents.documentId, created.id));
    assert.equal(events.length, 1);
    assert.equal(new FileSigningRequestStore(join(directory, "requests.json")).findByDocumentId(created.id)?.status, status);
    console.log(`✓ ${status}: A → B → webhook HMAC → PostgreSQL → Socket.IO; duplicado y firma inválida verificados.`);
  }
  console.log("Demo completada correctamente. Se eliminan únicamente los datos creados por esta ejecución.");
} catch (error) {
  console.error("Demo fallida:", error instanceof Error ? error.message : error);
  console.error("Comprueba que DATABASE_URL apunta a PostgreSQL disponible (o inicia docker compose up -d postgres).");
  process.exitCode = 1;
} finally {
  socket?.disconnect();
  if (socketServer) await new Promise<void>((resolve) => socketServer!.close(() => resolve()));
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.listening ? server.close(() => resolve()) : resolve())));
  try {
    for (const id of ids) {
      await db.delete(webhookDeliveries).where(eq(webhookDeliveries.documentId, id));
      await repository.deleteById(id);
    }
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
    await pool.end();
  }
}
