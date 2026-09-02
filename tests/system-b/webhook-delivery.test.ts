import { describe, expect, it, vi } from "vitest";
import { verifyWebhookSignature } from "../../src/shared/webhook-signature.js";
import { FetchWebhookDelivery } from "../../src/system-b/webhook-delivery.js";

describe("FetchWebhookDelivery", () => {
  it("signs and retries delivery three times", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const service = new FetchWebhookDelivery({ hmacSecret: "test-secret-at-least-16-characters", timeoutMs: 100, maxAttempts: 3, baseDelayMs: 50, fetchImplementation, sleep });
    const result = await service.deliver("http://system-a.test/webhooks/absign", { documentId: "2f5e0a24-7951-4e09-94d0-52fe7800f77a", status: "approved", timestamp: "2026-09-02T12:00:00.000Z" });
    expect(result).toEqual({ delivered: true, attempts: 3 });
    expect(sleep).toHaveBeenNthCalledWith(1, 50);
    expect(sleep).toHaveBeenNthCalledWith(2, 100);
    const init = fetchImplementation.mock.calls[0]?.[1];
    const payload = JSON.parse(String(init?.body));
    const signature = new Headers(init?.headers).get("x-signature") ?? undefined;
    expect(verifyWebhookSignature(payload, signature, "test-secret-at-least-16-characters")).toBe(true);
  });

  it("reports a persistent interruption", async () => {
    const service = new FetchWebhookDelivery({ hmacSecret: "test-secret-at-least-16-characters", timeoutMs: 100, maxAttempts: 3, baseDelayMs: 10, fetchImplementation: vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")), sleep: vi.fn().mockResolvedValue(undefined) });
    await expect(service.deliver("http://system-a.test/webhooks/absign", { documentId: "2f5e0a24-7951-4e09-94d0-52fe7800f77a", status: "approved", timestamp: "2026-09-02T12:00:00.000Z" })).resolves.toEqual({ delivered: false, attempts: 3, error: "offline" });
  });
});
