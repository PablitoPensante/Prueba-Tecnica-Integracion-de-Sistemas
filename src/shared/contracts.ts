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

export const webhookDataSchema = z.object({
  documentId: z.uuid(),
  status: z.enum(["approved", "rejected"]),
  reason: z.string().min(1).optional(),
  timestamp: z.iso.datetime(),
});
export const decideDocumentSchema = z.object({ status: z.enum(["approved", "rejected"]), reason: z.string().trim().min(1).optional() });
export type DecideDocumentInput = z.infer<typeof decideDocumentSchema>;

export const webhookPayloadSchema = webhookDataSchema.extend({
  signature: z.string().regex(/^[a-f\d]{64}$/i),
});

export type SubmitDocumentInput = z.infer<typeof submitDocumentSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type WebhookData = z.infer<typeof webhookDataSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export function parseWebhookPayload(input: unknown): WebhookPayload {
  return webhookPayloadSchema.parse(input);
}
