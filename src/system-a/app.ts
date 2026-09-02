import express from "express";
import { resolve } from "node:path";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { errorHandler, notFoundHandler } from "../shared/http.js";
import type { DocumentRepository } from "./document-repository.js";
import { DrizzleDocumentRepository } from "./drizzle-document-repository.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { createWebhooksRouter } from "./routes/webhooks.js";
import { FetchSystemBClient, type SystemBClient } from "./system-b-client.js";

interface SystemADependencies {
  repository?: DocumentRepository;
  systemBClient?: SystemBClient;
  callbackUrl?: string;
  hmacSecret?: string;
}

export function createSystemAApp(dependencies: SystemADependencies = {}) {
  const app = express();
  const repository = dependencies.repository ?? new DrizzleDocumentRepository(db);
  const systemBClient =
    dependencies.systemBClient ??
    new FetchSystemBClient({
      baseUrl: env.SYSTEM_B_URL,
      timeoutMs: env.HTTP_TIMEOUT_MS,
    });

  app.use(express.json());
  app.get("/health", (_request, response) => {
    response.json({ system: "A", status: "ok" });
  });
  app.use(
    "/documents",
    createDocumentsRouter({
      repository,
      systemBClient,
      callbackUrl:
        dependencies.callbackUrl ?? `${env.SYSTEM_A_URL}/webhooks/absign`,
    }),
  );
  app.use(
    "/webhooks",
    createWebhooksRouter({
      repository,
      hmacSecret: dependencies.hmacSecret ?? env.HMAC_SECRET,
    }),
  );

  app.use("/assets", express.static(resolve(process.cwd(), "frontend/shared")));
  app.use(express.static(resolve(process.cwd(), "frontend/system-a")));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
