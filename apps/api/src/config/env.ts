import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // Cloud Run injects PORT; 8080 is its default.
  PORT: z.coerce.number().int().positive().default(8080),
  // Comma-separated list of browser origins allowed to call the API.
  WEB_ORIGINS: z.string().default('http://localhost:3000'),
  APP_VERSION: z.string().default('dev'),
  // Required from milestone 1 onwards; optional while only /health exists.
  DATABASE_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export function allowedOrigins(env: Env): string[] {
  return env.WEB_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
