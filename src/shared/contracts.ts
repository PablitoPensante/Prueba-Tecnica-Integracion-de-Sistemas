import { z } from "zod";

export const createDocumentSchema = z.object({
  thirdPartyEmail: z.email(),
  fileUrl: z.url(),
});

export const submitDocumentSchema = z.object({
  documentId: z.uuid(),
  thirdPartyEmail: z.email(),
  fileUrl: z.url(),
  callbackUrl: z.url(),
});

export const webhookPayloadSchema = z.object({
  documentId: z.uuid(),
  status: z.enum(["approved", "rejected"]),
  reason: z.string().min(1).optional(),
  timestamp: z.iso.datetime(),
  signature: z.string().optional(),
});

export type SubmitDocumentInput = z.infer<typeof submitDocumentSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export function parseWebhookPayload(input: unknown): WebhookPayload {
  return webhookPayloadSchema.parse(input);
}
