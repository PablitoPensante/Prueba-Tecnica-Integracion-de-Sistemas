import request from "supertest";
import { unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
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
  it("uploads a document and submits its local public URL", async () => {
    const repository = new InMemoryDocumentRepository();
    const submitDocument = vi.fn().mockResolvedValue(undefined);
    const app = createSystemAApp({
      repository,
      systemBClient: createClient(submitDocument),
      callbackUrl: "http://system-a.test/webhooks/absign",
    });

    const response = await request(app)
      .post("/documents")
      .field("thirdPartyEmail", "reviewer@example.com")
      .attach("document", Buffer.from("%PDF-1.4 test"), {
        filename: "contract.pdf",
        contentType: "application/pdf",
      })
      .expect(201);

    expect(response.body.fileUrl).toMatch(/^http:\/\/localhost:3000\/uploads\/.+\.pdf$/);
    expect(submitDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fileUrl: response.body.fileUrl }),
    );
    await request(app).get(new URL(response.body.fileUrl).pathname).expect(200);
    await unlink(resolve(process.cwd(), "uploads", basename(response.body.fileUrl)));
  });

  it("accepts text and spreadsheet-compatible uploads", async () => {
    const repository = new InMemoryDocumentRepository();
    const app = createSystemAApp({
      repository,
      systemBClient: createClient(vi.fn().mockResolvedValue(undefined)),
    });
    const response = await request(app)
      .post("/documents")
      .field("thirdPartyEmail", "reviewer@example.com")
      .attach("document", Buffer.from("name,value\nitem,10"), {
        filename: "report.csv",
        contentType: "text/csv",
      })
      .expect(201);
    expect(response.body.fileUrl).toMatch(/\.csv$/);
    await unlink(resolve(process.cwd(), "uploads", basename(response.body.fileUrl)));
  });

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
