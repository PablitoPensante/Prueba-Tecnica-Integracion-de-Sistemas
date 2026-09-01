import { Router } from "express";
import { webhookPayloadSchema } from "../../shared/contracts.js";
import { verifyWebhookSignature } from "../../shared/webhook-signature.js";
import type { DocumentRepository } from "../document-repository.js";

interface WebhooksRouterOptions {
  repository: DocumentRepository;
  hmacSecret: string;
}

export function createWebhooksRouter(options: WebhooksRouterOptions) {
  const router = Router();

  router.post("/absign", async (request, response) => {
    const payload = webhookPayloadSchema.parse(request.body);
    const headerSignature = request.get("X-Signature");

    if (!verifyWebhookSignature(payload, headerSignature, options.hmacSecret)) {
      await options.repository.recordIncident({
        type: "invalid_webhook_signature",
        documentId: payload.documentId,
        detail: "Webhook signature did not match the shared secret",
      });
      response.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    const result = await options.repository.processWebhook(payload);

    if (result === "not_found") {
      response.status(404).json({ error: "Document not found" });
      return;
    }

    response.status(200).json({
      processed: result === "processed",
      duplicate: result === "duplicate",
    });
  });

  return router;
}
