import type { DecideDocumentInput, SubmitDocumentInput } from "../shared/contracts.js";
import { submitDocumentSchema } from "../shared/contracts.js";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const savedRequestsSchema = z.array(submitDocumentSchema.extend({
  status: z.enum(["pending", "approved", "rejected"]),
  receivedAt: z.iso.datetime().transform((value) => new Date(value)),
  decidedAt: z.iso.datetime().transform((value) => new Date(value)).nullable(),
  reason: z.string().nullable(),
  deliveryStatus: z.enum(["not_attempted", "delivered", "failed"]),
  deliveryAttempts: z.number().int().nonnegative(),
  lastDeliveryError: z.string().nullable(),
}));

export interface SigningRequest extends SubmitDocumentInput {
  status: "pending" | "approved" | "rejected";
  receivedAt: Date;
  decidedAt: Date | null; reason: string | null; deliveryStatus: "not_attempted" | "delivered" | "failed"; deliveryAttempts: number; lastDeliveryError: string | null;
}

export interface SigningRequestStore {
  create(input: SubmitDocumentInput): SigningRequest | undefined;
  findByDocumentId(documentId: string): SigningRequest | undefined;
  findAll(): SigningRequest[];
  decide(documentId: string, input: DecideDocumentInput): SigningRequest | undefined;
  recordDelivery(documentId: string, result: { delivered: boolean; attempts: number; error?: string }): SigningRequest | undefined;
  delete(documentId: string): boolean;
}

export class InMemorySigningRequestStore implements SigningRequestStore {
  protected readonly requests = new Map<string, SigningRequest>();

  create(input: SubmitDocumentInput): SigningRequest | undefined {
    if (this.requests.has(input.documentId)) {
      return undefined;
    }

    const request: SigningRequest = {
      ...input,
      status: "pending",
      receivedAt: new Date(),
      decidedAt: null, reason: null, deliveryStatus: "not_attempted", deliveryAttempts: 0, lastDeliveryError: null,
    };

    this.requests.set(request.documentId, request);
    return request;
  }

  findByDocumentId(documentId: string): SigningRequest | undefined {
    return this.requests.get(documentId);
  }
  findAll(): SigningRequest[] {
    return [...this.requests.values()].sort(
      (left, right) => right.receivedAt.getTime() - left.receivedAt.getTime(),
    );
  }
  decide(id: string, input: DecideDocumentInput) { const current = this.requests.get(id); if (!current || current.status !== "pending") return undefined; const updated = { ...current, status: input.status, reason: input.reason ?? null, decidedAt: new Date() }; this.requests.set(id, updated); return updated; }
  recordDelivery(id: string, result: { delivered: boolean; attempts: number; error?: string }) { const current = this.requests.get(id); if (!current) return undefined; const updated = { ...current, deliveryStatus: result.delivered ? "delivered" as const : "failed" as const, deliveryAttempts: result.attempts, lastDeliveryError: result.error ?? null }; this.requests.set(id, updated); return updated; }
  delete(documentId: string): boolean { return this.requests.delete(documentId); }
}

export class FileSigningRequestStore extends InMemorySigningRequestStore {
  constructor(private readonly filePath: string) {
    super();
    mkdirSync(dirname(filePath), { recursive: true });
    try {
      const saved = savedRequestsSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
      for (const item of saved) {
        this.requests.set(item.documentId, item);
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        this.persist();
      } else {
        throw new Error(`No se pudieron cargar las solicitudes de Sistema B: ${filePath}. El archivo se conserva para su recuperación.`, { cause: error });
      }
    }
  }
  private persist() {
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, JSON.stringify(this.findAll(), null, 2));
      renameSync(temporaryPath, this.filePath);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }
  override create(input: SubmitDocumentInput) { const value = super.create(input); if (value) this.persist(); return value; }
  override decide(id: string, input: DecideDocumentInput) { const value = super.decide(id, input); if (value) this.persist(); return value; }
  override recordDelivery(id: string, result: { delivered: boolean; attempts: number; error?: string }) { const value = super.recordDelivery(id, result); if (value) this.persist(); return value; }
  override delete(id: string) { const deleted = super.delete(id); if (deleted) this.persist(); return deleted; }
}
