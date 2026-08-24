import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  BOOTSTRAP_TOKEN: z.string().min(16),
  CORS_ORIGIN: z.string().url().optional()
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source = process.env): Environment {
  return environmentSchema.parse(source);
}
