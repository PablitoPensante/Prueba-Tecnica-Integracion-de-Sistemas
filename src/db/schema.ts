import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "sent",
  "approved",
  "rejected",
]);

export const webhookStatusEnum = pgEnum("webhook_status", ["approved", "rejected"]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: documentStatusEnum("status").notNull().default("created"),
  thirdPartyEmail: text("third_party_email").notNull(),
  fileUrl: text("file_url").notNull(),
  reason: text("reason"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    status: webhookStatusEnum("status").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processed: boolean("processed").notNull().default(false),
  },
  (table) => [
    uniqueIndex("webhook_events_document_status_unique").on(
      table.documentId,
      table.status,
    ),
  ],
);

export const integrationIncidents = pgTable("integration_incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  documentId: uuid("document_id"),
  detail: text("detail").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
