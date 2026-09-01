import { z } from "zod";

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
  // TODO(consulta TypeScript #1): El enunciado menciona `signature` en el payload,
  // pero también exige `X-Signature`. ¿Conviene modelar dos esquemas (cuerpo
  // firmado vs. request recibida) para que TypeScript impida incluir la firma
  // dentro de los bytes sobre los que calculamos el HMAC?
  signature: z.string().optional(),
});

export type SubmitDocumentInput = z.infer<typeof submitDocumentSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
