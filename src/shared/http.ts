import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import {
  maxDocumentSizeBytes,
  UnsupportedDocumentTypeError,
} from "./upload-errors.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    const fieldLabels: Record<string, string> = {
      subject: "asunto",
      thirdPartyEmail: "correo del firmante",
      fileUrl: "archivo",
      callbackUrl: "URL de retorno",
      documentId: "identificador del documento",
      status: "estado",
      reason: "motivo",
      timestamp: "fecha del evento",
      signature: "firma",
    };
    const invalidFields = [
      ...new Set(
        error.issues.map((issue) => {
          const field = String(issue.path[0] ?? "solicitud");
          return fieldLabels[field] ?? field;
        }),
      ),
    ];
    response.status(400).json({
      error: "Invalid request",
      message: `Revisa ${invalidFields.join(", ")} e inténtalo nuevamente.`,
      issues: error.issues,
    });
    return;
  }

  if (error instanceof UnsupportedDocumentTypeError) {
    response.status(415).json({
      error: "Unsupported document type",
      message: error.message,
      allowedExtensions: ["pdf", "doc", "docx", "xls", "xlsx", "txt", "csv"],
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    response.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "Document too large" : "Invalid upload",
      message: tooLarge
        ? `El archivo supera el límite de ${maxDocumentSizeBytes / 1024 / 1024} MB.`
        : "No se pudo procesar el archivo enviado.",
      code: error.code,
    });
    return;
  }

  // Drizzle wraps the original PostgreSQL error in `cause`.
  const errorCode = databaseErrorCode(error);

  if (errorCode === "42P01" || errorCode === "42703") {
    console.error("Database schema is not ready:", error);
    response.status(503).json({
      error: "Database schema is not ready",
      message: "La base de datos necesita migraciones. Reinicia con npm run dev.",
    });
    return;
  }

  if (
    errorCode === "ECONNREFUSED" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "57P01"
  ) {
    console.error("Database is unavailable:", error);
    response.status(503).json({
      error: "Database unavailable",
      message: "PostgreSQL no está disponible. Revisa Docker y DATABASE_URL.",
    });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};

function databaseErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
