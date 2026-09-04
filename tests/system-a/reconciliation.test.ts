import { describe, expect, it, vi } from "vitest";
import { InMemoryDocumentRepository } from "../../src/system-a/document-repository.js";
import { DocumentReconciler } from "../../src/system-a/reconciliation.js";
import type { SystemBClient } from "../../src/system-a/system-b-client.js";

async function sentDocument(repository: InMemoryDocumentRepository) {
  const document = await repository.create({
    subject: "Contrato recuperable",
    thirdPartyEmail: "reviewer@example.com",
    fileUrl: "https://files.example.com/contract.pdf",
  });
  await repository.markSent(document.id, new Date());
  return document;
}

function client(getDocumentStatus: SystemBClient["getDocumentStatus"]): SystemBClient {
  return { submitDocument: vi.fn(), getDocumentStatus };
}

describe("DocumentReconciler", () => {
  it("recovers a decision when webhook delivery was interrupted", async () => {
    const repository = new InMemoryDocumentRepository();
    const document = await sentDocument(repository);
    const events = { documentStatusChanged: vi.fn(), integrationIncident: vi.fn() };
    const reconciler = new DocumentReconciler(repository, client(vi.fn().mockResolvedValue({
      documentId: document.id,
      status: "approved",
      timestamp: "2026-09-03T12:00:00.000Z",
    })), events);

    await reconciler.runOnce();

    expect((await repository.findById(document.id))?.status).toBe("approved");
    expect(repository.incidents).toContainEqual(expect.objectContaining({
      type: "webhook_delivery_recovered",
      documentId: document.id,
    }));
    expect(events.documentStatusChanged).toHaveBeenCalledWith(expect.objectContaining({ id: document.id, status: "approved" }));
    expect(events.integrationIncident).toHaveBeenCalledWith(expect.objectContaining({ type: "webhook_delivery_recovered" }));
  });

  it("is idempotent and never regresses a resolved document", async () => {
    const repository = new InMemoryDocumentRepository();
    const document = await sentDocument(repository);
    const getDocumentStatus = vi.fn().mockResolvedValue({ documentId: document.id, status: "rejected", reason: "Incomplete" });
    const reconciler = new DocumentReconciler(repository, client(getDocumentStatus));

    await reconciler.runOnce();
    await reconciler.runOnce();

    expect((await repository.findById(document.id))?.status).toBe("rejected");
    expect(getDocumentStatus).toHaveBeenCalledOnce();
    expect(repository.incidents.filter((item) => item.type === "webhook_delivery_recovered")).toHaveLength(1);
  });

  it("records a definitive incident after the status query exhausts its retries", async () => {
    const repository = new InMemoryDocumentRepository();
    const document = await sentDocument(repository);
    const reconciler = new DocumentReconciler(repository, client(vi.fn().mockRejectedValue(new Error("System B unavailable after 3 attempts"))));

    await reconciler.runOnce();

    expect((await repository.findById(document.id))?.status).toBe("sent");
    expect(repository.incidents).toEqual([expect.objectContaining({
      type: "reconciliation_failed",
      documentId: document.id,
    })]);
  });
});
