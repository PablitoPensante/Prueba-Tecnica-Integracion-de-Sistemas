import type {
  CreateDocumentInput,
  WebhookPayload,
} from "../shared/contracts.js";

export type DocumentStatus = "pending" | "sent" | "approved" | "rejected";

export interface DocumentRecord extends CreateDocumentInput {
  id: string;
  status: DocumentStatus;
  reason: string | null;
  sentAt: Date | null;
  resolvedAt: Date | null;
}

export type WebhookProcessingResult = "processed" | "duplicate" | "not_found";

export interface IntegrationIncidentInput {
  type: string;
  documentId?: string;
  detail: string;
}

export interface DocumentRepository {
  create(input: CreateDocumentInput): Promise<DocumentRecord>;
  findById(documentId: string): Promise<DocumentRecord | undefined>;
  markSent(documentId: string, sentAt: Date): Promise<DocumentRecord | undefined>;
  processWebhook(payload: WebhookPayload): Promise<WebhookProcessingResult>;
  recordIncident(incident: IntegrationIncidentInput): Promise<void>;
}

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, DocumentRecord>();
  private readonly processedEvents = new Set<string>();
  readonly incidents: IntegrationIncidentInput[] = [];

  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const document: DocumentRecord = {
      id: crypto.randomUUID(),
      ...input,
      status: "pending",
      reason: null,
      sentAt: null,
      resolvedAt: null,
    };
    this.documents.set(document.id, document);
    return document;
  }

  async findById(documentId: string): Promise<DocumentRecord | undefined> {
    return this.documents.get(documentId);
  }

  async markSent(
    documentId: string,
    sentAt: Date,
  ): Promise<DocumentRecord | undefined> {
    const document = this.documents.get(documentId);
    if (!document) return undefined;

    const updated = { ...document, status: "sent" as const, sentAt };
    this.documents.set(documentId, updated);
    return updated;
  }

  async processWebhook(payload: WebhookPayload): Promise<WebhookProcessingResult> {
    const document = this.documents.get(payload.documentId);
    if (!document) return "not_found";

    const eventKey = `${payload.documentId}:${payload.status}`;
    if (this.processedEvents.has(eventKey)) return "duplicate";

    this.processedEvents.add(eventKey);
    this.documents.set(payload.documentId, {
      ...document,
      status: payload.status,
      reason: payload.reason ?? null,
      resolvedAt: new Date(payload.timestamp),
    });
    return "processed";
  }

  async recordIncident(incident: IntegrationIncidentInput): Promise<void> {
    this.incidents.push(incident);
  }
}
