import request from "supertest";
import { describe, expect, it } from "vitest";
import { createSystemAApp } from "../src/system-a/app.js";
import { createSystemBApp } from "../src/system-b/app.js";

describe("service health checks", () => {
  it("identifies System A", async () => {
    const response = await request(createSystemAApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ system: "A", status: "ok" });
  });

  it("identifies System B", async () => {
    const response = await request(createSystemBApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ system: "B", status: "ok" });
  });
});
