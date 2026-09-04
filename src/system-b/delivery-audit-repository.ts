import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.js";

export interface DeliveryAuditInput {
  documentId: string;
  callbackUrl: string;
  status: "approved" | "rejected";
  delivered: boolean;
  attempts: number;
  error?: string;
}

export interface DeliveryAuditRepository {
  record(input: DeliveryAuditInput): Promise<void>;
}

export class InMemoryDeliveryAuditRepository implements DeliveryAuditRepository {
  readonly entries: DeliveryAuditInput[] = [];
  async record(input: DeliveryAuditInput): Promise<void> {
    this.entries.push(input);
  }
}

export class DrizzleDeliveryAuditRepository implements DeliveryAuditRepository {
  constructor(private readonly database: NodePgDatabase<typeof schema>) {}
  async record(input: DeliveryAuditInput): Promise<void> {
    await this.database.insert(schema.webhookDeliveries).values(input);
  }
}
