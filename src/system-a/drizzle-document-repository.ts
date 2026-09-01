import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { CreateDocumentInput, WebhookPayload } from "../shared/contracts.js";
import * as schema from "../db/schema.js";
import {
  type DocumentRecord,
  type DocumentRepository,
  type IntegrationIncidentInput,
  type WebhookProcessingResult,
} from "./document-repository.js";

type Database = NodePgDatabase<typeof schema>;

export class DrizzleDocumentRepository implements DocumentRepository {
  constructor(private readonly database: Database) {}

  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const [created] = await this.database
      .insert(schema.documents)
      .values(input)
      .returning();

    if (!created) throw new Error("Document insert returned no record");
    return created;
  }

  async findById(documentId: string): Promise<DocumentRecord | undefined> {
    const [document] = await this.database
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId))
      .limit(1);
    return document;
  }

  async markSent(
    documentId: string,
    sentAt: Date,
  ): Promise<DocumentRecord | undefined> {
    const [updated] = await this.database
      .update(schema.documents)
      .set({ status: "sent", sentAt })
      .where(eq(schema.documents.id, documentId))
      .returning();
    return updated;
  }

  async processWebhook(payload: WebhookPayload): Promise<WebhookProcessingResult> {
    return this.database.transaction(async (transaction) => {
      const [document] = await transaction
        .select({ id: schema.documents.id })
        .from(schema.documents)
        .where(eq(schema.documents.id, payload.documentId))
        .limit(1);

      if (!document) return "not_found";

      const insertedEvents = await transaction
        .insert(schema.webhookEvents)
        .values({
          documentId: payload.documentId,
          status: payload.status,
          payload,
          processed: true,
        })
        .onConflictDoNothing({
          target: [schema.webhookEvents.documentId, schema.webhookEvents.status],
        })
        .returning({ id: schema.webhookEvents.id });

      if (insertedEvents.length === 0) return "duplicate";

      await transaction
        .update(schema.documents)
        .set({
          status: payload.status,
          reason: payload.reason ?? null,
          resolvedAt: new Date(payload.timestamp),
        })
        .where(
          and(
            eq(schema.documents.id, payload.documentId),
            eq(schema.documents.status, "sent"),
          ),
        );

      return "processed";
    });
  }

  async recordIncident(incident: IntegrationIncidentInput): Promise<void> {
    await this.database.insert(schema.integrationIncidents).values(incident);
  }
}
