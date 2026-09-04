import { z } from "zod";
import type { Server } from "socket.io";
import type { IntegrationEvents } from "../shared/integration-events.js";
import type { DocumentRecord, IntegrationIncidentInput } from "../system-a/document-repository.js";

export class SocketIntegrationEvents implements IntegrationEvents {
  constructor(private readonly io: Server) {}

  documentStatusChanged(document: DocumentRecord): void {
    this.io.to(`document:${document.id}`).emit("document:statusChanged", document);
  }

  integrationIncident(incident: IntegrationIncidentInput): void {
    this.io.to("admins").emit("integration:incident", incident);
  }
}

export function configureSocketRooms(io: Server, adminToken: string): void {
  io.on("connection", (socket) => {
    socket.on("document:subscribe", async (documentId: unknown, acknowledge?: (accepted: boolean) => void) => {
      const parsed = z.uuid().safeParse(documentId);
      if (!parsed.success) {
        acknowledge?.(false);
        return;
      }
      await socket.join(`document:${parsed.data}`);
      acknowledge?.(true);
    });

    socket.on("admin:subscribe", async (token: unknown, acknowledge?: (accepted: boolean) => void) => {
      if (token !== adminToken) {
        acknowledge?.(false);
        return;
      }
      await socket.join("admins");
      acknowledge?.(true);
    });
  });
}
