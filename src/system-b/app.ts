import express from "express";
import { errorHandler, notFoundHandler } from "../shared/http.js";

export function createSystemBApp() {
  const app = express();

  app.use(express.json());
  app.get("/health", (_request, response) => {
    response.json({ system: "B", status: "ok" });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
