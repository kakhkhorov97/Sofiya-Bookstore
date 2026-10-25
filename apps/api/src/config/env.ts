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
  // Signs session cookies. Required by the auth module; at least 32 chars.
  AUTH_SECRET: z.string().min(32).optional(),
  // Sign-in/sign-up attempts per minute per IP.
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // A blank line like `GEMINI_API_KEY=` in .env means "not set".
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(
      ([, v]) => v !== undefined && v.trim() !== '',
    ),
  );
  const parsed = EnvSchema.safeParse(cleaned);
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
