import { describe, expect, it } from "vitest";
import { envSchema } from "../../src/config/env.js";

describe("database configuration", () => {
  it.each([
    "postgresql:postgres:postgres@127.0.0.1:5433/absing",
    "postgresql://localhost",
    "https://localhost/absign",
    "not-a-url",
  ])("rejects malformed DATABASE_URL before connecting: %s", (DATABASE_URL) => {
    expect(envSchema.safeParse({ DATABASE_URL }).success).toBe(false);
  });

  it.each(["postgresql", "postgres"])("accepts %s with an explicit database and host port", (protocol) => {
    const DATABASE_URL = `${protocol}://postgres:password@127.0.0.1:5433/absign`;
    expect(envSchema.parse({ DATABASE_URL }).DATABASE_URL).toBe(DATABASE_URL);
  });
});
