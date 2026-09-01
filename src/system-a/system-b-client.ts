import type { SubmitDocumentInput } from "../shared/contracts.js";
import { withBackoff, type RetryOptions } from "../shared/retry.js";

export interface RemoteDocumentStatus {
  documentId: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
}

export interface SystemBClient {
  submitDocument(input: SubmitDocumentInput): Promise<void>;
  getDocumentStatus(documentId: string): Promise<RemoteDocumentStatus>;
}

export class HttpResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface FetchSystemBClientOptions {
  baseUrl: string;
  timeoutMs: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  fetchImplementation?: typeof fetch;
  sleep?: RetryOptions["sleep"];
}

export class FetchSystemBClient implements SystemBClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(private readonly options: FetchSystemBClientOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 200;
  }

  async submitDocument(input: SubmitDocumentInput): Promise<void> {
    await this.requestWithRetry(`${this.options.baseUrl}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async getDocumentStatus(documentId: string): Promise<RemoteDocumentStatus> {
    const response = await this.requestWithRetry(
      `${this.options.baseUrl}/documents/${documentId}/status`,
      { method: "GET" },
    );
    return (await response.json()) as RemoteDocumentStatus;
  }

  private async requestWithRetry(url: string, init: RequestInit): Promise<Response> {
    return withBackoff(
      async () => {
        const response = await this.fetchImplementation(url, {
          ...init,
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });

        if (!response.ok) {
          throw new HttpResponseError(
            `System B responded with ${response.status}`,
            response.status,
          );
        }
        return response;
      },
      {
        maxAttempts: this.maxAttempts,
        baseDelayMs: this.baseDelayMs,
        ...(this.options.sleep ? { sleep: this.options.sleep } : {}),
        shouldRetry: (error) =>
          !(error instanceof HttpResponseError) ||
          error.status === 429 ||
          error.status >= 500,
      },
    );
  }
}
