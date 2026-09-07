import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SYSTEM_A_PORT: z.coerce.number().int().positive().default(3000),
  SYSTEM_B_PORT: z.coerce.number().int().positive().default(4000),
  SYSTEM_A_URL: z.url().default("http://localhost:3000"),
  SYSTEM_B_URL: z.url().default("http://localhost:4000"),
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .refine((value) => {
      if (!URL.canParse(value)) return false;
      const url = new URL(value);
      return Boolean(url.hostname) && url.pathname.length > 1;
    }, "DATABASE_URL debe indicar servidor y base de datos: postgresql://usuario:clave@127.0.0.1:5433/absign")
    .default("postgresql://postgres:postgres@localhost:5432/absign"),
  HMAC_SECRET: z.string().min(16).default("development-secret-change-me"),
  ADMIN_SOCKET_TOKEN: z.string().min(16).default("development-admin-token"),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(3).default(3),
  WEBHOOK_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  RECONCILIATION_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
});

export const env = envSchema.parse(process.env);
