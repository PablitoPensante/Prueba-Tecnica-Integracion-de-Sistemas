import express from "express";
import { errorHandler, notFoundHandler } from "../shared/http.js";
import { createDocumentsRouter } from "./routes/documents.js";
import {
  InMemorySigningRequestStore,
  type SigningRequestStore,
} from "./signing-request-store.js";

interface SystemBDependencies {
  signingRequestStore?: SigningRequestStore;
}

export function createSystemBApp(dependencies: SystemBDependencies = {}) {
  const app = express();
  const signingRequestStore =
    dependencies.signingRequestStore ?? new InMemorySigningRequestStore();

  app.use(express.json());
  app.get("/health", (_request, response) => {
    response.json({ system: "B", status: "ok" });
  });
  app.use("/documents", createDocumentsRouter(signingRequestStore));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
