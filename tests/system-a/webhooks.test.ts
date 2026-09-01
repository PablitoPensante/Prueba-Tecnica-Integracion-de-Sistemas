import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { WebhookData } from "../../src/shared/contracts.js";
import { createSignedWebhook } from "../../src/shared/webhook-signature.js";
import { createSystemAApp } from "../../src/system-a/app.js";
import { InMemoryDocumentRepository } from "../../src/system-a/document-repository.js";
import type { SystemBClient } from "../../src/system-a/system-b-client.js";

const hmacSecret = "test-shared-secret-with-enough-length";

function successfulSystemBClient(): SystemBClient {
  return {
    submitDocument: vi.fn().mockResolvedValue(undefined),
    getDocumentStatus: vi.fn(),
  };
}

async function createSentDocument(
  repository: InMemoryDocumentRepository,
  app: ReturnType<typeof createSystemAApp>,
) {
  const response = await request(app).post("/documents").send({
    thirdPartyEmail: "reviewer@example.com",
    fileUrl: "https://files.example.com/contract.pdf",
  });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

function approvedWebhook(documentId: string): WebhookData {
  return {
    documentId,
    status: "approved",
    timestamp: new Date().toISOString(),
  };
}

describe("POST /webhooks/absign", () => {
  it("processes a valid approved webhook and updates the document", async () => {
    const repository = new InMemoryDocumentRepository();
    const app = createSystemAApp({
      repository,
      systemBClient: successfulSystemBClient(),
      hmacSecret,
    });
    const documentId = await createSentDocument(repository, app);
    const payload = createSignedWebhook(approvedWebhook(documentId), hmacSecret);

    const response = await request(app)
      .post("/webhooks/absign")
      .set("X-Signature", payload.signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ processed: true, duplicate: false });
    expect((await repository.findById(documentId))?.status).toBe("approved");
  });

  it("rejects an invalid signature without changing the document", async () => {
    const repository = new InMemoryDocumentRepository();
    const app = createSystemAApp({
      repository,
      systemBClient: successfulSystemBClient(),
      hmacSecret,
    });
    const documentId = await createSentDocument(repository, app);
    const payload = createSignedWebhook(approvedWebhook(documentId), hmacSecret);

    const response = await request(app)
      .post("/webhooks/absign")
      .set("X-Signature", "0".repeat(64))
      .send(payload);

    expect(response.status).toBe(401);
    expect((await repository.findById(documentId))?.status).toBe("sent");
    expect(repository.incidents.at(-1)?.type).toBe("invalid_webhook_signature");
  });

  it("treats the same document and status as an idempotent duplicate", async () => {
    const repository = new InMemoryDocumentRepository();
    const app = createSystemAApp({
      repository,
      systemBClient: successfulSystemBClient(),
      hmacSecret,
    });
    const documentId = await createSentDocument(repository, app);
    const payload = createSignedWebhook(approvedWebhook(documentId), hmacSecret);

    await request(app)
      .post("/webhooks/absign")
      .set("X-Signature", payload.signature)
      .send(payload)
      .expect(200);
    const duplicate = await request(app)
      .post("/webhooks/absign")
      .set("X-Signature", payload.signature)
      .send(payload);

    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toEqual({ processed: false, duplicate: true });
    expect((await repository.findById(documentId))?.status).toBe("approved");
  });
});
