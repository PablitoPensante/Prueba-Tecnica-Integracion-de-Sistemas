import { Router } from "express";
import { createDocumentSchema } from "../../shared/contracts.js";
import type { DocumentRepository } from "../document-repository.js";
import type { SystemBClient } from "../system-b-client.js";

interface DocumentsRouterOptions {
  repository: DocumentRepository;
  systemBClient: SystemBClient;
  callbackUrl: string;
}

export function createDocumentsRouter(options: DocumentsRouterOptions) {
  const router = Router();

  router.get("/:documentId", async (request, response) => {
    const document = await options.repository.findById(request.params.documentId);
    if (!document) {
      response.status(404).json({ error: "Document not found" });
      return;
    }
    response.json(document);
  });

  router.post("/", async (request, response) => {
    const input = createDocumentSchema.parse(request.body);
    const document = await options.repository.create(input);

    try {
      await options.systemBClient.submitDocument({
        documentId: document.id,
        ...input,
        callbackUrl: options.callbackUrl,
      });
      const sentDocument = await options.repository.markSent(document.id, new Date());
      response.status(201).json(sentDocument);
    } catch (error) {
      await options.repository.recordIncident({
        type: "document_submission_failed",
        documentId: document.id,
        detail: error instanceof Error ? error.message : "Unknown submission error",
      });
      response.status(502).json({
        error: "System B is unavailable",
        documentId: document.id,
        status: "pending",
      });
    }
  });

  return router;
}
