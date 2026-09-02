import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createSystemBApp } from "../../src/system-b/app.js";
import { InMemorySigningRequestStore } from "../../src/system-b/signing-request-store.js";

function validSubmission(documentId: string = randomUUID()) {
  return {
    documentId,
    thirdPartyEmail: "reviewer@example.com",
    fileUrl: "https://files.example.com/contract.pdf",
    callbackUrl: "http://localhost:3000/webhooks/absign",
  };
}

describe("POST /documents in System B", () => {
  it("lists received documents for its frontend", async () => {
    const app = createSystemBApp();
    const input = validSubmission();
    await request(app).post("/documents").send(input).expect(202);
    const response = await request(app).get("/documents").expect(200);
    expect(response.body).toEqual([
      expect.objectContaining({ documentId: input.documentId, status: "pending" }),
    ]);
  });

  it("accepts and stores a valid signing request", async () => {
    const store = new InMemorySigningRequestStore();
    const input = validSubmission();

    const response = await request(
      createSystemBApp({ signingRequestStore: store }),
    )
      .post("/documents")
      .send(input);

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      documentId: input.documentId,
      status: "pending",
    });
    expect(store.findByDocumentId(input.documentId)).toMatchObject(input);
  });

  it("rejects a request that does not match the Zod contract", async () => {
    const response = await request(createSystemBApp())
      .post("/documents")
      .send(validSubmission("not-a-uuid"));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid request");
  });

  it("rejects a duplicated document", async () => {
    const app = createSystemBApp();
    const input = validSubmission();

    await request(app).post("/documents").send(input).expect(202);
    const duplicateResponse = await request(app)
      .post("/documents")
      .send(input);

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.documentId).toBe(input.documentId);
  });
});

describe("DELETE /documents/:documentId in System B", () => {
  it("deletes a signing request", async () => {
    const store = new InMemorySigningRequestStore();
    const app = createSystemBApp({ signingRequestStore: store });
    const input = validSubmission();
    await request(app).post("/documents").send(input).expect(202);
    await request(app).delete(`/documents/${input.documentId}`).expect(204);
    expect(store.findByDocumentId(input.documentId)).toBeUndefined();
  });
});
