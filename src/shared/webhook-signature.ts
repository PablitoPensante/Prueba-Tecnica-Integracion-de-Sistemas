import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookData, WebhookPayload } from "./contracts.js";

function signingMaterial(data: WebhookData): string {
  return JSON.stringify({
    documentId: data.documentId,
    status: data.status,
    ...(data.reason ? { reason: data.reason } : {}),
    timestamp: data.timestamp,
  });
}

export function signWebhook(data: WebhookData, secret: string): string {
  return createHmac("sha256", secret).update(signingMaterial(data)).digest("hex");
}

export function createSignedWebhook(
  data: WebhookData,
  secret: string,
): WebhookPayload {
  return { ...data, signature: signWebhook(data, secret) };
}

export function verifyWebhookSignature(
  payload: WebhookPayload,
  headerSignature: string | undefined,
  secret: string,
): boolean {
  if (!headerSignature || headerSignature !== payload.signature) return false;

  const expected = Buffer.from(signWebhook(payload, secret), "hex");
  const received = Buffer.from(headerSignature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
