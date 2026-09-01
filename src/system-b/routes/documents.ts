import { Router } from "express";
import { submitDocumentSchema } from "../../shared/contracts.js";
import type { SigningRequestStore } from "../signing-request-store.js";

export function createDocumentsRouter(store: SigningRequestStore) {
  const router = Router();

  router.post("/", (request, response) => {
    const input = submitDocumentSchema.parse(request.body);
    const signingRequest = store.create(input);

    if (!signingRequest) {
      response.status(409).json({
        error: "Document already submitted",
        documentId: input.documentId,
      });
      return;
    }

    response.status(202).json({
      documentId: signingRequest.documentId,
      status: signingRequest.status,
      receivedAt: signingRequest.receivedAt.toISOString(),
    });
  });

  return router;
}
