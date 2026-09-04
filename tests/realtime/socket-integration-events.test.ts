import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { configureSocketRooms, SocketIntegrationEvents } from "../../src/realtime/socket-integration-events.js";

describe("Socket.IO integration events", () => {
  const adminToken = "test-admin-token-secure";
  const clients: Socket[] = [];
  const servers: Server[] = [];

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  async function setup() {
    const httpServer = createServer();
    const io = new Server(httpServer);
    servers.push(io);
    configureSocketRooms(io, adminToken);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
    const client = createClient(`http://127.0.0.1:${address.port}`, { transports: ["websocket"], forceNew: true, reconnection: false });
    clients.push(client);
    await new Promise<void>((resolve) => client.once("connect", resolve));
    return { client, events: new SocketIntegrationEvents(io) };
  }

  it("emits status changes only to the subscribed document room", async () => {
    const { client, events } = await setup();
    const documentId = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => client.emit("document:subscribe", documentId, (accepted: boolean) => accepted ? resolve() : reject(new Error("Subscription rejected"))));
    const received = new Promise<{ id: string; status: string }>((resolve) => client.once("document:statusChanged", resolve));

    events.documentStatusChanged({ id: documentId, subject: "Contrato", thirdPartyEmail: "reviewer@example.com", fileUrl: "https://example.com/a.pdf", status: "approved", reason: null, sentAt: new Date(), resolvedAt: new Date() });

    await expect(received).resolves.toMatchObject({ id: documentId, status: "approved" });
  });

  it("rejects invalid rooms and emits incidents to administrators", async () => {
    const { client, events } = await setup();
    await expect(new Promise<boolean>((resolve) => client.emit("document:subscribe", "not-a-uuid", resolve))).resolves.toBe(false);
    await expect(new Promise<boolean>((resolve) => client.emit("admin:subscribe", "wrong-token", resolve))).resolves.toBe(false);
    await new Promise<void>((resolve, reject) => client.emit("admin:subscribe", adminToken, (accepted: boolean) => accepted ? resolve() : reject(new Error("Admin subscription rejected"))));
    const received = new Promise<{ type: string }>((resolve) => client.once("integration:incident", resolve));

    events.integrationIncident({ type: "reconciliation_failed", detail: "offline" });

    await expect(received).resolves.toEqual({ type: "reconciliation_failed", detail: "offline" });
  });
});
