import express from "express";
import { resolve } from "node:path";
import { env } from "../config/env.js";
import { errorHandler, notFoundHandler } from "../shared/http.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { FetchWebhookDelivery, type WebhookDelivery } from "./webhook-delivery.js";
import {
  InMemorySigningRequestStore,
  FileSigningRequestStore,
  type SigningRequestStore,
} from "./signing-request-store.js";

interface SystemBDependencies {
  signingRequestStore?: SigningRequestStore;
  webhookDelivery?: WebhookDelivery;
}

export function createSystemBApp(dependencies: SystemBDependencies = {}) {
  const app = express();
  const signingRequestStore = dependencies.signingRequestStore ??
    (env.NODE_ENV === "test"
      ? new InMemorySigningRequestStore()
      : new FileSigningRequestStore(resolve(process.cwd(), "data/system-b-requests.json")));
  const webhookDelivery = dependencies.webhookDelivery ?? new FetchWebhookDelivery({ hmacSecret: env.HMAC_SECRET, timeoutMs: env.HTTP_TIMEOUT_MS, maxAttempts: env.WEBHOOK_MAX_ATTEMPTS, baseDelayMs: env.WEBHOOK_BASE_DELAY_MS });

  app.use(express.json());
  app.get("/health", (_request, response) => {
    response.json({ system: "B", status: "ok" });
  });
  app.use("/documents", createDocumentsRouter(signingRequestStore, webhookDelivery));
  app.use("/assets", express.static(resolve(process.cwd(), "frontend/shared")));
  app.use(express.static(resolve(process.cwd(), "frontend/system-b")));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
