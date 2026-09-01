import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SYSTEM_A_PORT: z.coerce.number().int().positive().default(3000),
  SYSTEM_B_PORT: z.coerce.number().int().positive().default(4000),
  SYSTEM_A_URL: z.url().default("http://localhost:3000"),
  SYSTEM_B_URL: z.url().default("http://localhost:4000"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/absign"),
  HMAC_SECRET: z.string().min(16).default("development-secret-change-me"),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
});

export const env = envSchema.parse(process.env);
