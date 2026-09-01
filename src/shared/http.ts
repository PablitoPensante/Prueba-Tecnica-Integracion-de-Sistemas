import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request", issues: error.issues });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};
