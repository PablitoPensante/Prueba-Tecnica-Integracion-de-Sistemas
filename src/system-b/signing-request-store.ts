import type { DecideDocumentInput, SubmitDocumentInput } from "../shared/contracts.js";

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
}

export class InMemorySigningRequestStore implements SigningRequestStore {
  private readonly requests = new Map<string, SigningRequest>();

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
}
