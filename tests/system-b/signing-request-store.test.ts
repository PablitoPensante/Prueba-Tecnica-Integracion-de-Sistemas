import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileSigningRequestStore } from "../../src/system-b/signing-request-store.js";

describe("FileSigningRequestStore", () => {
  const directories: string[] = [];
  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("preserves receipt and decision dates, reason and delivery audit after restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "absign-store-"));
    directories.push(directory);
    const file = join(directory, "requests.json");
    const store = new FileSigningRequestStore(file);
    const documentId = crypto.randomUUID();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    store.create({ documentId, subject: "Contrato", thirdPartyEmail: "reviewer@example.com", fileUrl: "http://localhost/file.pdf", callbackUrl: "http://localhost/webhook" });
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    store.decide(documentId, { status: "rejected", reason: "Falta información" });
    store.recordDelivery(documentId, { delivered: false, attempts: 3, error: "Timeout" });
    const expected = store.findByDocumentId(documentId);
    vi.setSystemTime(new Date("2026-09-07T12:00:00.000Z"));

    expect(new FileSigningRequestStore(file).findByDocumentId(documentId)).toEqual(expected);
  });

  it.each(["{invalid JSON", '[{"documentId":"invalid"}]'])("does not overwrite unreadable persisted data: %s", async (content) => {
    const directory = await mkdtemp(join(tmpdir(), "absign-store-"));
    directories.push(directory);
    const file = join(directory, "requests.json");
    await writeFile(file, content);

    expect(() => new FileSigningRequestStore(file)).toThrow();
    expect(await readFile(file, "utf8")).toBe(content);
  });

  it("persists requests and their deletion between restarts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "absign-store-"));
    const file = join(directory, "requests.json");
    const input = { documentId: crypto.randomUUID(), subject: "Contrato de servicios", thirdPartyEmail: "reviewer@example.com", fileUrl: "http://localhost/file.pdf", callbackUrl: "http://localhost/webhook" };
    new FileSigningRequestStore(file).create(input);
    const restored = new FileSigningRequestStore(file);
    expect(restored.findByDocumentId(input.documentId)).toMatchObject(input);
    restored.delete(input.documentId);
    expect(new FileSigningRequestStore(file).findAll()).toEqual([]);
    await rm(directory, { recursive: true });
  });
});
