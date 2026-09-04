import type { WebhookData } from "../shared/contracts.js";
import type { DocumentRepository } from "./document-repository.js";
import type { SystemBClient } from "./system-b-client.js";

export class DocumentReconciler {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly systemBClient: SystemBClient,
  ) {}

  async runOnce(): Promise<void> {
    const documents = await this.repository.findByStatus("sent");
    await Promise.all(documents.map((document) => this.reconcile(document.id)));
  }

  private async reconcile(documentId: string): Promise<void> {
    try {
      const remote = await this.systemBClient.getDocumentStatus(documentId);
      if (remote.status === "pending") return;

      const payload: WebhookData = {
        documentId,
        status: remote.status,
        timestamp: remote.timestamp ?? new Date().toISOString(),
        ...(remote.reason ? { reason: remote.reason } : {}),
      };
      const result = await this.repository.processReconciliation(payload);
      if (result === "processed") {
        await this.repository.recordIncident({
          type: "webhook_delivery_recovered",
          documentId,
          detail: `Recovered ${remote.status} status through reconciliation`,
        });
      }
    } catch (error) {
      await this.repository.recordIncident({
        type: "reconciliation_failed",
        documentId,
        detail: error instanceof Error ? error.message : "Unknown reconciliation error",
      });
    }
  }
}
