import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSystemAApp } from "../../src/system-a/app.js";
import { InMemoryDocumentRepository } from "../../src/system-a/document-repository.js";
import type { SystemBClient } from "../../src/system-a/system-b-client.js";

function createClient(submitDocument: SystemBClient["submitDocument"]): SystemBClient {
  return {
    submitDocument,
    getDocumentStatus: vi.fn(),
  };
}

describe("POST /documents in System A", () => {
  it("creates, submits and marks a document as sent", async () => {
    const repository = new InMemoryDocumentRepository();
    const submitDocument = vi.fn().mockResolvedValue(undefined);
    const app = createSystemAApp({
      repository,
      systemBClient: createClient(submitDocument),
      callbackUrl: "http://system-a.test/webhooks/absign",
    });

    const response = await request(app).post("/documents").send({
      thirdPartyEmail: "reviewer@example.com",
      fileUrl: "https://files.example.com/contract.pdf",
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("sent");
    expect(submitDocument).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: response.body.id }),
    );
    expect((await repository.findById(response.body.id))?.status).toBe("sent");
  });

  it("keeps the document pending and records an incident when System B fails", async () => {
    const repository = new InMemoryDocumentRepository();
    const app = createSystemAApp({
      repository,
      systemBClient: createClient(
        vi.fn().mockRejectedValue(new Error("connection timeout")),
      ),
    });

    const response = await request(app).post("/documents").send({
      thirdPartyEmail: "reviewer@example.com",
      fileUrl: "https://files.example.com/contract.pdf",
    });

    expect(response.status).toBe(502);
    expect(response.body.status).toBe("pending");
    expect(repository.incidents).toEqual([
      expect.objectContaining({
        type: "document_submission_failed",
        documentId: response.body.documentId,
      }),
    ]);
  });
});
