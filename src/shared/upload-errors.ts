export const maxDocumentSizeBytes = 10 * 1024 * 1024;

export class UnsupportedDocumentTypeError extends Error {
  readonly code = "UNSUPPORTED_DOCUMENT_TYPE";

  constructor(readonly extension: string) {
    super(
      "Formato no permitido. Usa PDF, Word, Excel, TXT o CSV.",
    );
  }
}
