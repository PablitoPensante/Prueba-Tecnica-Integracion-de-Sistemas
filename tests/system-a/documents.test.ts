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
      .field("subject", "Contrato de servicios")
      .field("thirdPartyEmail", "reviewer@example.com")
      .attach("document", Buffer.from("%PDF-1.4 test"), {
        filename: "contract.pdf",
        contentType: "application/pdf",
      })
      .expect(201);

    expect(response.body.fileUrl).toMatch(/^http:\/\/localhost:3000\/uploads\/.+\.pdf$/);
    expect(response.body.subject).toBe("Contrato de servicios");
    expect(submitDocument).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Contrato de servicios", fileUrl: response.body.fileUrl }),
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
      .field("subject", "Reporte mensual")
      .field("thirdPartyEmail", "reviewer@example.com")
      .attach("document", Buffer.from("name,value\nitem,10"), {
        filename: "report.csv",
        contentType: "text/csv",
      })
      .expect(201);
    expect(response.body.fileUrl).toMatch(/\.csv$/);
    await unlink(resolve(process.cwd(), "uploads", basename(response.body.fileUrl)));
  });

  it("accepts an allowed extension when the browser reports a generic MIME type", async () => {
    const repository = new InMemoryDocumentRepository();
    const app = createSystemAApp({
      repository,
      systemBClient: createClient(vi.fn().mockResolvedValue(undefined)),
    });
    const response = await request(app)
      .post("/documents")
      .field("subject", "Documento con MIME genérico")
      .field("thirdPartyEmail", "reviewer@example.com")
      .attach("document", Buffer.from("%PDF-1.4 test"), {
        filename: "generic.pdf",
        contentType: "application/octet-stream",
      })
      .expect(201);

    expect(response.body.status).toBe("sent");
    await unlink(resolve(process.cwd(), "uploads", basename(response.body.fileUrl)));
  });

  it("returns a useful 415 response for an unsupported extension", async () => {
    const response = await request(createSystemAApp({
      repository: new InMemoryDocumentRepository(),
      systemBClient: createClient(vi.fn()),
    }))
      .post("/documents")
      .field("subject", "Imagen")
      .field("thirdPartyEmail", "reviewer@example.com")
      .attach("document", Buffer.from("image"), {
        filename: "photo.png",
        contentType: "image/png",
      })
      .expect(415);

    expect(response.body).toMatchObject({
      error: "Unsupported document type",
      message: expect.stringContaining("PDF"),
    });
  });

  it("returns 413 instead of 500 when an upload exceeds 10 MB", async () => {
    const response = await request(createSystemAApp({
      repository: new InMemoryDocumentRepository(),
      systemBClient: createClient(vi.fn()),
    }))
      .post("/documents")
      .field("subject", "Archivo demasiado grande")
      .field("thirdPartyEmail", "reviewer@example.com")
      .attach("document", Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: "large.pdf",
        contentType: "application/pdf",
      })
      .expect(413);

    expect(response.body).toMatchObject({
      error: "Document too large",
      code: "LIMIT_FILE_SIZE",
    });
  });

  it("explains field validation errors instead of returning only Invalid request", async () => {
    const response = await request(createSystemAApp({
      repository: new InMemoryDocumentRepository(),
      systemBClient: createClient(vi.fn()),
    }))
      .post("/documents")
      .field("subject", "")
      .field("thirdPartyEmail", "not-an-email")
      .attach("document", Buffer.from("text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      })
      .expect(400);

    expect(response.body.message).toContain("asunto, correo del firmante");
    expect(response.body.issues).toHaveLength(2);
  });

  it("returns 400 instead of 500 when the request has no form fields", async () => {
    const response = await request(createSystemAApp({
      repository: new InMemoryDocumentRepository(),
      systemBClient: createClient(vi.fn()),
    }))
      .post("/documents")
      .expect(400);

    expect(response.body.error).toBe("Invalid request");
    expect(response.body.issues).toHaveLength(3);
  });

  it("returns an actionable 503 when database migrations are missing", async () => {
    const repository = new InMemoryDocumentRepository();
    repository.create = vi.fn().mockRejectedValue(
      Object.assign(new Error('column "subject" does not exist'), { code: "42703" }),
    );
    const response = await request(createSystemAApp({
      repository,
      systemBClient: createClient(vi.fn()),
    }))
      .post("/documents")
      .send({
        subject: "Contrato",
        thirdPartyEmail: "reviewer@example.com",
        fileUrl: "https://files.example.com/contract.pdf",
      })
      .expect(503);

    expect(response.body.message).toContain("migraciones");
  });

  it.each([
    ["42703", "migraciones"],
    ["ECONNREFUSED", "PostgreSQL"],
  ])("recognizes database errors wrapped by Drizzle: %s", async (code, message) => {
    const repository = new InMemoryDocumentRepository();
    repository.create = vi.fn().mockRejectedValue(new Error("Failed query", {
      cause: Object.assign(new Error("Database failure"), { code }),
    }));
    const response = await request(createSystemAApp({ repository, systemBClient: createClient(vi.fn()) }))
      .post("/documents")
      .send({ subject: "Contrato", thirdPartyEmail: "reviewer@example.com", fileUrl: "https://files.example.com/contract.pdf" })
      .expect(503);
    expect(response.body.message).toContain(message);
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
      subject: "Contrato de servicios",
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
      subject: "Contrato de servicios",
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

describe("DELETE /documents/:documentId in System A", () => {
  it("deletes an existing document", async () => {
    const repository = new InMemoryDocumentRepository();
    const document = await repository.create({ subject: "Contrato de servicios", thirdPartyEmail: "reviewer@example.com", fileUrl: "https://example.com/document.pdf" });
    await request(createSystemAApp({ repository })).delete(`/documents/${document.id}`).expect(204);
    expect(await repository.findById(document.id)).toBeUndefined();
  });
});
