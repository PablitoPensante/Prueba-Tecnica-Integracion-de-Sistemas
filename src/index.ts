import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { db, pool } from "./db/client.js";
import { createSystemAApp } from "./system-a/app.js";
import { DrizzleDocumentRepository } from "./system-a/drizzle-document-repository.js";
import { DocumentReconciler } from "./system-a/reconciliation.js";
import { FetchSystemBClient } from "./system-a/system-b-client.js";
import { createSystemBApp } from "./system-b/app.js";
import { configureSocketRooms, SocketIntegrationEvents } from "./realtime/socket-integration-events.js";

const documentRepository = new DrizzleDocumentRepository(db);
const systemBClient = new FetchSystemBClient({ baseUrl: env.SYSTEM_B_URL, timeoutMs: env.HTTP_TIMEOUT_MS });
let systemAApp: ReturnType<typeof createSystemAApp>;
const systemAHttpServer = createServer((request, response) => systemAApp(request, response));
const systemBHttpServer = createServer(createSystemBApp());

// Socket.IO belongs to System A because that is where the UI observes state changes.
const io = new SocketIOServer(systemAHttpServer, { cors: { origin: "*" } });
configureSocketRooms(io, env.ADMIN_SOCKET_TOKEN);
const events = new SocketIntegrationEvents(io);
systemAApp = createSystemAApp({ repository: documentRepository, systemBClient, events });

const reconciler = new DocumentReconciler(documentRepository, systemBClient, events);
let reconciliationRunning = false;
const reconciliationTimer = setInterval(() => {
  if (reconciliationRunning) return;
  reconciliationRunning = true;
  void reconciler.runOnce()
    .catch((error: unknown) => console.error("Reconciliation failed:", error))
    .finally(() => { reconciliationRunning = false; });
}, env.RECONCILIATION_INTERVAL_MS);
reconciliationTimer.unref();

systemAHttpServer.listen(env.SYSTEM_A_PORT, () => {
  console.log(`System A listening at ${env.SYSTEM_A_URL}`);
});

systemBHttpServer.listen(env.SYSTEM_B_PORT, () => {
  console.log(`System B listening at ${env.SYSTEM_B_URL}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down.`);
  clearInterval(reconciliationTimer);
  io.close();
  systemAHttpServer.close();
  systemBHttpServer.close();
  await pool.end();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
