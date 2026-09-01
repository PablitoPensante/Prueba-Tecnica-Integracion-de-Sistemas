import type { SubmitDocumentInput } from "../shared/contracts.js";

export interface SigningRequest extends SubmitDocumentInput {
  status: "pending";
  receivedAt: Date;
}

export interface SigningRequestStore {
  create(input: SubmitDocumentInput): SigningRequest | undefined;
  findByDocumentId(documentId: string): SigningRequest | undefined;
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
    };

    this.requests.set(request.documentId, request);
    return request;
  }

  findByDocumentId(documentId: string): SigningRequest | undefined {
    return this.requests.get(documentId);
  }
}
