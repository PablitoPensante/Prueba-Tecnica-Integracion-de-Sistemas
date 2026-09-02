import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileSigningRequestStore } from "../../src/system-b/signing-request-store.js";

describe("FileSigningRequestStore", () => {
  it("persists requests and their deletion between restarts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "absign-store-"));
    const file = join(directory, "requests.json");
    const input = { documentId: crypto.randomUUID(), thirdPartyEmail: "reviewer@example.com", fileUrl: "http://localhost/file.pdf", callbackUrl: "http://localhost/webhook" };
    new FileSigningRequestStore(file).create(input);
    const restored = new FileSigningRequestStore(file);
    expect(restored.findByDocumentId(input.documentId)).toMatchObject(input);
    restored.delete(input.documentId);
    expect(new FileSigningRequestStore(file).findAll()).toEqual([]);
    await rm(directory, { recursive: true });
  });
});
