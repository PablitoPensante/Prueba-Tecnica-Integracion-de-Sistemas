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

  it("serves the System A frontend", async () => {
    const response = await request(createSystemAApp()).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Sistema A · Gestión documental");
  });

  it("serves the System B frontend", async () => {
    const response = await request(createSystemBApp()).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Sistema B · Firma documental");
    expect(response.text).toContain("Revisar documento");
    expect(response.text).toContain("previewDialog");
  });

  it("serves the shared blue light and dark theme", async () => {
    const response = await request(createSystemAApp()).get("/assets/theme.css");
    expect(response.status).toBe(200);
    expect(response.text).toContain("--primary: #2563eb");
    expect(response.text).toContain('[data-theme="dark"]');
  });
});
