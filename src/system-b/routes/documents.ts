import { Router } from "express";
import { decideDocumentSchema, submitDocumentSchema } from "../../shared/contracts.js";
import type { SigningRequestStore } from "../signing-request-store.js";
import type { WebhookDelivery } from "../webhook-delivery.js";

export function createDocumentsRouter(store: SigningRequestStore, delivery: WebhookDelivery) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(store.findAll().map((item) => ({
      documentId: item.documentId,
      thirdPartyEmail: item.thirdPartyEmail,
      fileUrl: item.fileUrl,
      status: item.status,
      receivedAt: item.receivedAt.toISOString(),
      reason: item.reason,
      deliveryStatus: item.deliveryStatus,
      deliveryAttempts: item.deliveryAttempts,
    })));
  });

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
  router.get("/:documentId/status", (request, response) => { const item = store.findByDocumentId(request.params.documentId); if (!item) { response.status(404).json({ error: "Document not found" }); return; } response.json({ documentId: item.documentId, status: item.status, ...(item.reason ? { reason: item.reason } : {}), ...(item.decidedAt ? { timestamp: item.decidedAt.toISOString() } : {}), deliveryStatus: item.deliveryStatus, deliveryAttempts: item.deliveryAttempts, ...(item.lastDeliveryError ? { lastDeliveryError: item.lastDeliveryError } : {}) }); });
  router.post("/:documentId/decision", async (request, response) => { const current = store.findByDocumentId(request.params.documentId); if (!current) { response.status(404).json({ error: "Document not found" }); return; } if (current.status !== "pending") { response.status(409).json({ error: "Document already decided" }); return; } const input = decideDocumentSchema.parse(request.body); const decided = store.decide(current.documentId, input); if (!decided?.decidedAt || decided.status === "pending") throw new Error("Decision could not be persisted"); const result = await delivery.deliver(decided.callbackUrl, { documentId: decided.documentId, status: decided.status, ...(decided.reason ? { reason: decided.reason } : {}), timestamp: decided.decidedAt.toISOString() }); store.recordDelivery(decided.documentId, result); response.status(result.delivered ? 200 : 202).json({ documentId: decided.documentId, status: decided.status, webhook: result }); });

  return router;
}
