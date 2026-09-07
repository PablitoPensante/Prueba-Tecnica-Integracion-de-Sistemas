import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import multer from "multer";
import {
  maxDocumentSizeBytes,
  UnsupportedDocumentTypeError,
} from "../shared/upload-errors.js";

export const uploadsDirectory = resolve(process.cwd(), "uploads");
mkdirSync(uploadsDirectory, { recursive: true });

const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
]);

export const documentUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (_request, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: maxDocumentSizeBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      callback(new UnsupportedDocumentTypeError(extension));
      return;
    }

    // Browsers and operating systems disagree on MIME types for Office and CSV
    // files. The allowlisted extension determines acceptance; files receive a
    // generated name and are served with the matching extension afterwards.
    callback(null, true);
  },
});
