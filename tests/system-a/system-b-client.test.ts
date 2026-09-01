import { describe, expect, it, vi } from "vitest";
import { FetchSystemBClient } from "../../src/system-a/system-b-client.js";

const submission = {
  documentId: "2f5e0a24-7951-4e09-94d0-52fe7800f77a",
  thirdPartyEmail: "reviewer@example.com",
  fileUrl: "https://files.example.com/contract.pdf",
  callbackUrl: "http://localhost:3000/webhooks/absign",
};

describe("FetchSystemBClient", () => {
  it("retries retryable responses with backoff", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new FetchSystemBClient({
      baseUrl: "http://system-b.test",
      timeoutMs: 100,
      fetchImplementation,
      sleep,
    });

    await client.submitDocument(submission);

    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 200);
    expect(sleep).toHaveBeenNthCalledWith(2, 400);
  });

  it("does not retry a permanent client error", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 400 }));
    const client = new FetchSystemBClient({
      baseUrl: "http://system-b.test",
      timeoutMs: 100,
      fetchImplementation,
      sleep: vi.fn(),
    });

    await expect(client.submitDocument(submission)).rejects.toThrow(
      "System B responded with 400",
    );
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });
});
