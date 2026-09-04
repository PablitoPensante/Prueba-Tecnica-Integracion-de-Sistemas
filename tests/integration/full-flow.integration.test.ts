import { createServer, type Server as HttpServer } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { Server as SocketIOServer } from "socket.io";
import { io as createSocketClient, type Socket } from "socket.io-client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db, pool } from "../../src/db/client.js";
import * as schema from "../../src/db/schema.js";
import { configureSocketRooms, SocketIntegrationEvents } from "../../src/realtime/socket-integration-events.js";
import { createSignedWebhook } from "../../src/shared/webhook-signature.js";
import { createSystemAApp } from "../../src/system-a/app.js";
import { DrizzleDocumentRepository } from "../../src/system-a/drizzle-document-repository.js";
import { DocumentReconciler } from "../../src/system-a/reconciliation.js";
import { FetchSystemBClient } from "../../src/system-a/system-b-client.js";
import { createSystemBApp } from "../../src/system-b/app.js";
import { DrizzleDeliveryAuditRepository } from "../../src/system-b/delivery-audit-repository.js";
import { InMemorySigningRequestStore } from "../../src/system-b/signing-request-store.js";
import { FetchWebhookDelivery, type WebhookDelivery } from "../../src/system-b/webhook-delivery.js";

const enabled = process.env.RUN_POSTGRES_TESTS === "true";
const hmacSecret = "integration-secret-at-least-16-characters";
const adminToken = "integration-admin-token";

describe.runIf(enabled)("complete integration with PostgreSQL", () => {
  const httpServers: HttpServer[] = [];
  const socketServers: SocketIOServer[] = [];
  const socketClients: Socket[] = [];
  const documentIds: string[] = [];

  afterEach(async () => {
    socketClients.splice(0).forEach((socket) => socket.disconnect());
    await Promise.all(socketServers.splice(0).map((io) => new Promise<void>((resolve) => io.close(() => resolve()))));
    await Promise.all(httpServers.splice(0).map((server) => new Promise<void>((resolve) => server.listening ? server.close(() => resolve()) : resolve())));
    if (documentIds.length) {
      await db.delete(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.documentId, documentIds));
      await db.delete(schema.webhookEvents).where(inArray(schema.webhookEvents.documentId, documentIds));
      await db.delete(schema.integrationIncidents).where(inArray(schema.integrationIncidents.documentId, documentIds));
      await db.delete(schema.documents).where(inArray(schema.documents.id, documentIds));
      documentIds.splice(0);
    }
  });

  afterAll(async () => pool.end());

  it("covers A to B, webhook, PostgreSQL, Socket.IO, duplicate, invalid signature, timeout and recovery", async () => {
    const repository = new DrizzleDocumentRepository(db);
    const store = new InMemorySigningRequestStore();
    let failDelivery = false;
    let actualDelivery: FetchWebhookDelivery;
    const switchableDelivery: WebhookDelivery = {
      deliver: (url, data) => failDelivery
        ? Promise.resolve({ delivered: false, attempts: 3, error: "integration timeout" })
        : actualDelivery.deliver(url, data),
    };

    const systemBServer = createServer(createSystemBApp({
      signingRequestStore: store,
      webhookDelivery: switchableDelivery,
      deliveryAuditRepository: new DrizzleDeliveryAuditRepository(db),
    }));
    httpServers.push(systemBServer);
    await listen(systemBServer);
    const systemBUrl = serverUrl(systemBServer);

    const systemBClient = new FetchSystemBClient({ baseUrl: systemBUrl, timeoutMs: 500, maxAttempts: 3, baseDelayMs: 1 });
    let systemAApp: ReturnType<typeof createSystemAApp>;
    const systemAServer = createServer((request, response) => systemAApp(request, response));
    httpServers.push(systemAServer);
    const io = new SocketIOServer(systemAServer);
    socketServers.push(io);
    configureSocketRooms(io, adminToken);
    const events = new SocketIntegrationEvents(io);
    await listen(systemAServer);
    const systemAUrl = serverUrl(systemAServer);
    systemAApp = createSystemAApp({ repository, systemBClient, callbackUrl: `${systemAUrl}/webhooks/absign`, events, hmacSecret });
    actualDelivery = new FetchWebhookDelivery({ hmacSecret, timeoutMs: 500, maxAttempts: 3, baseDelayMs: 1 });

    const socket = createSocketClient(systemAUrl, { transports: ["websocket"], forceNew: true, reconnection: false });
    socketClients.push(socket);
    await new Promise<void>((resolve) => socket.once("connect", resolve));

    const approved = await createDocument(systemAUrl, "Contrato aprobado");
    documentIds.push(approved.id);
    await subscribe(socket, approved.id);
    const approvedEvent = nextEvent(socket, "document:statusChanged");
    const approvedDecision = await fetch(`${systemBUrl}/documents/${approved.id}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
    expect(approvedDecision.status).toBe(200);
    await expect(approvedEvent).resolves.toMatchObject({ id: approved.id, status: "approved" });
    expect((await repository.findById(approved.id))?.status).toBe("approved");

    const duplicateData = { documentId: approved.id, status: "approved" as const, timestamp: new Date().toISOString() };
    const duplicatePayload = createSignedWebhook(duplicateData, hmacSecret);
    const duplicate = await fetch(`${systemAUrl}/webhooks/absign`, { method: "POST", headers: { "content-type": "application/json", "x-signature": duplicatePayload.signature }, body: JSON.stringify(duplicatePayload) });
    expect(await duplicate.json()).toMatchObject({ processed: false, duplicate: true });

    const invalid = await fetch(`${systemAUrl}/webhooks/absign`, { method: "POST", headers: { "content-type": "application/json", "x-signature": "0".repeat(64) }, body: JSON.stringify(duplicatePayload) });
    expect(invalid.status).toBe(401);

    failDelivery = true;
    const recovered = await createDocument(systemAUrl, "Contrato recuperado");
    documentIds.push(recovered.id);
    await subscribe(socket, recovered.id);
    const failedDecision = await fetch(`${systemBUrl}/documents/${recovered.id}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "rejected", reason: "Información incompleta" }) });
    expect(failedDecision.status).toBe(202);
    expect((await repository.findById(recovered.id))?.status).toBe("sent");

    const recoveredEvent = nextEvent(socket, "document:statusChanged");
    await new DocumentReconciler(repository, systemBClient, events).runOnce();
    await expect(recoveredEvent).resolves.toMatchObject({ id: recovered.id, status: "rejected", reason: "Información incompleta" });
    expect((await repository.findById(recovered.id))?.status).toBe("rejected");
    const [audit] = await db.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.documentId, recovered.id));
    expect(audit).toMatchObject({ delivered: false, attempts: 3, error: "integration timeout" });
  }, 15_000);
});

async function listen(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function serverUrl(server: HttpServer): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server has no TCP address");
  return `http://127.0.0.1:${address.port}`;
}

async function createDocument(systemAUrl: string, subject: string) {
  const response = await fetch(`${systemAUrl}/documents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subject, thirdPartyEmail: "reviewer@example.com", fileUrl: "https://files.example.com/document.pdf" }),
  });
  expect(response.status).toBe(201);
  return await response.json() as { id: string; status: string };
}

async function subscribe(socket: Socket, documentId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => socket.emit("document:subscribe", documentId, (accepted: boolean) => accepted ? resolve() : reject(new Error("Room rejected"))));
}

function nextEvent(socket: Socket, event: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => socket.once(event, resolve));
}
