import { Router } from "express";
import { unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createDocumentSchema } from "../../shared/contracts.js";
import type { DocumentRepository } from "../document-repository.js";
import type { SystemBClient } from "../system-b-client.js";
import { documentUpload } from "../document-upload.js";

interface DocumentsRouterOptions {
  repository: DocumentRepository;
  systemBClient: SystemBClient;
  callbackUrl: string;
  publicUrl: string;
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

  router.delete("/:documentId", async (request, response) => {
    const document = await options.repository.deleteById(request.params.documentId);
    if (!document) {
      response.status(404).json({ error: "Document not found" });
      return;
    }
    try {
      const url = new URL(document.fileUrl);
      if (url.pathname.startsWith("/uploads/")) {
        await unlink(resolve(process.cwd(), "uploads", basename(url.pathname)));
      }
    } catch {
      // The database record is deleted even if an old external file is unavailable.
    }
    response.sendStatus(204);
  });

  router.post("/", documentUpload.single("document"), async (request, response) => {
    const input = createDocumentSchema.parse({
      thirdPartyEmail: request.body.thirdPartyEmail,
      fileUrl: request.file
        ? `${options.publicUrl}/uploads/${request.file.filename}`
        : request.body.fileUrl,
    });
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
