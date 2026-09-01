import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";
import { createSystemAApp } from "./system-a/app.js";
import { createSystemBApp } from "./system-b/app.js";

const systemAHttpServer = createServer(createSystemAApp());
const systemBHttpServer = createServer(createSystemBApp());

// Socket.IO belongs to System A because that is where the UI observes state changes.
const io = new SocketIOServer(systemAHttpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("document:subscribe", async (documentId: string) => {
    const joinedRooms: string[] = await socket.join(`document:${documentId}`);
  });

  socket.on("admin:subscribe", () => {
    socket.join("admins");
  });
});

systemAHttpServer.listen(env.SYSTEM_A_PORT, () => {
  console.log(`System A listening at ${env.SYSTEM_A_URL}`);
});

systemBHttpServer.listen(env.SYSTEM_B_PORT, () => {
  console.log(`System B listening at ${env.SYSTEM_B_URL}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down.`);
  io.close();
  systemAHttpServer.close();
  systemBHttpServer.close();
  await pool.end();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
