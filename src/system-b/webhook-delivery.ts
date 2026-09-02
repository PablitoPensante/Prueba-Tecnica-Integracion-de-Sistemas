import type { WebhookData } from "../shared/contracts.js";
import { withBackoff, type RetryOptions } from "../shared/retry.js";
import { createSignedWebhook } from "../shared/webhook-signature.js";
export interface WebhookDeliveryResult { delivered: boolean; attempts: number; error?: string }
export interface WebhookDelivery { deliver(url: string, data: WebhookData): Promise<WebhookDeliveryResult> }
interface Options { hmacSecret: string; timeoutMs: number; maxAttempts: number; baseDelayMs: number; fetchImplementation?: typeof fetch; sleep?: RetryOptions["sleep"] }
export class FetchWebhookDelivery implements WebhookDelivery {
  constructor(private readonly options: Options) {}
  async deliver(url: string, data: WebhookData): Promise<WebhookDeliveryResult> {
    const payload = createSignedWebhook(data, this.options.hmacSecret); let attempts = 0;
    try {
      await withBackoff(async (attempt) => { attempts = attempt; const response = await (this.options.fetchImplementation ?? fetch)(url, { method: "POST", headers: { "content-type": "application/json", "x-signature": payload.signature }, body: JSON.stringify(payload), signal: AbortSignal.timeout(this.options.timeoutMs) }); if (!response.ok) throw new Error(`System A responded with ${response.status}`); }, { maxAttempts: this.options.maxAttempts, baseDelayMs: this.options.baseDelayMs, ...(this.options.sleep ? { sleep: this.options.sleep } : {}) });
      return { delivered: true, attempts };
    } catch (error) { return { delivered: false, attempts, error: error instanceof Error ? error.message : "Unknown delivery error" }; }
  }
}
