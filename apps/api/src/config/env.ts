import { z } from 'zod';
// Keeps zod's default messages in their zod 3 wording (see zod-messages.ts).
import '@sofiya/shared';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // Cloud Run injects PORT; 8080 is its default.
  PORT: z.coerce.number().int().positive().default(8080),
  // Comma-separated list of browser origins allowed to call the API.
  WEB_ORIGINS: z.string().default('http://localhost:3000'),
  APP_VERSION: z.string().default('dev'),
  // Where uploaded covers live: "local" (UPLOADS_DIR, for development) or
  // "gcs" (the GCS_BUCKET Cloud Storage bucket, required on Cloud Run,
  // whose disk does not survive restarts).
  STORAGE_DRIVER: z.enum(['local', 'gcs']).default('local'),
  UPLOADS_DIR: z.string().default('uploads'),
  GCS_BUCKET: z.string().min(3).optional(),
  // Which proxies may set X-Forwarded-For (Express "trust proxy"). Locally
  // the web app forwards /api from the same machine.
  TRUST_PROXY: z.string().default('loopback'),
  // Shared with the web app. Requests carrying it may name the visitor's IP
  // in X-Sofiya-Client-Ip (see clientIp.ts); on Cloud Run every request
  // arrives through the web app, so this is how rate limits see visitors.
  PROXY_SECRET: z.string().min(32).optional(),
  // Required from milestone 1 onwards; optional while only /health exists.
  DATABASE_URL: z.url().optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  // Model names are settings so they can be upgraded without code changes.
  // Measured 2026-10-26: 3.5-flash-lite answers in ~1s; 3.6-flash in ~5s
  // with richer answers. The fallback is tried when the main model fails.
  GEMINI_CHAT_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-3.6-flash'),
  GEMINI_EMBED_MODEL: z.string().default('gemini-embedding-001'),
  // "fake" = offline deterministic provider for tests; default is Gemini
  // when GEMINI_API_KEY is set, otherwise AI features are switched off.
  AI_PROVIDER: z.enum(['gemini', 'fake']).optional(),
  // Ask Sofiya requests per minute per IP, and per day for the whole site.
  AI_RATE_LIMIT: z.coerce.number().int().positive().default(8),
  // Meaning search with gemini-embedding-001 (measured on this catalogue:
  // real matches score 0.62-0.72 at the top, off-topic and nonsense
  // questions stay below 0.60). The best book must reach the floor; other
  // books must be within the window of the best one.
  AI_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.6),
  AI_SIMILARITY_WINDOW: z.coerce.number().min(0).max(1).default(0.06),
  AI_DAILY_CAP: z.coerce.number().int().positive().default(200),
  // Signs session cookies. Required by the auth module; at least 32 chars.
  AUTH_SECRET: z.string().min(32).optional(),
  // Sign-in/sign-up attempts per minute per IP.
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  // Toss Payments keys (test_ck_/test_sk_ for test mode, live_ for real
  // money). The client key is public; the secret key stays on the server.
  // Card payments are switched off until both are set.
  TOSS_CLIENT_KEY: z.string().min(1).optional(),
  TOSS_SECRET_KEY: z.string().min(1).optional(),
  // "fake" = offline gateway for tests and demos (never in production).
  PAYMENTS_PROVIDER: z.enum(['toss', 'fake']).optional(),
  // Currencies cards may be charged in. Toss needs a separate merchant
  // contract per currency, so only won by default.
  CARD_CURRENCIES: z
    .string()
    .default('KRW')
    .transform((v) =>
      v
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  // Unpaid card orders hold stock; they are cancelled after this long.
  CARD_PAYMENT_TIMEOUT_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(30),
  // Optional shared state for several API instances: rate limits and the
  // daily AI cap. redis:// or rediss:// (TLS, e.g. Upstash). Without it each
  // instance counts in memory.
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'must start with redis:// or rediss://')
    .optional(),
  // Email: "resend" sends through resend.com, "log" prints emails in the API
  // terminal (default locally), "off" disables email (default in production),
  // "memory" is for tests. Production refuses log/memory: reset links must
  // never end up in server logs.
  EMAIL_PROVIDER: z.enum(['resend', 'log', 'memory', 'off']).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default('Sofiya <onboarding@resend.dev>'),
  // Public address of the website, for links in emails. Defaults to the
  // first WEB_ORIGINS entry.
  WEB_URL: z.url().optional(),
  // "Continue with Google": an OAuth client (type "Web application") from
  // Google Cloud Console. The button appears only when both are set.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // "fake" = offline Google for tests (never in production).
  GOOGLE_AUTH: z.enum(['fake']).optional(),
  PASSWORD_RESET_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  // Shown to customers who choose bank transfer.
  BANK_NAME: z.string().max(100).optional(),
  BANK_ACCOUNT_NUMBER: z.string().max(100).optional(),
  BANK_ACCOUNT_HOLDER: z.string().max(100).optional(),
});

// Production must not start half-configured: a missing secret or local
// cover storage would only show up later as lost uploads or 500s.
const ProductionEnv = EnvSchema.superRefine((env, ctx) => {
  if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['RESEND_API_KEY'],
      message: 'required when EMAIL_PROVIDER is "resend"',
    });
  }
  if (env.NODE_ENV !== 'production') return;
  const need = (ok: boolean, path: string, message: string) => {
    if (!ok) ctx.addIssue({ code: 'custom', path: [path], message });
  };
  need(!!env.DATABASE_URL, 'DATABASE_URL', 'required in production');
  need(!!env.AUTH_SECRET, 'AUTH_SECRET', 'required in production');
  need(!!env.PROXY_SECRET, 'PROXY_SECRET', 'required in production');
  need(
    env.STORAGE_DRIVER === 'gcs',
    'STORAGE_DRIVER',
    'must be "gcs" in production',
  );
  need(
    env.EMAIL_PROVIDER !== 'log' && env.EMAIL_PROVIDER !== 'memory',
    'EMAIL_PROVIDER',
    'must be "resend" or "off" in production',
  );
  need(
    env.GOOGLE_AUTH !== 'fake',
    'GOOGLE_AUTH',
    'cannot be "fake" in production',
  );
  need(
    env.PAYMENTS_PROVIDER !== 'fake',
    'PAYMENTS_PROVIDER',
    'cannot be "fake" in production',
  );
  if (env.STORAGE_DRIVER === 'gcs') {
    need(
      !!env.GCS_BUCKET,
      'GCS_BUCKET',
      'required when STORAGE_DRIVER is "gcs"',
    );
  }
});

export type Env = z.infer<typeof EnvSchema>;

export const webUrl = (env: Env): string =>
  (env.WEB_URL ?? allowedOrigins(env)[0] ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // A blank line like `GEMINI_API_KEY=` in .env means "not set". Values are
  // trimmed: a key pasted into a CI variable or secret often carries a
  // trailing newline, which breaks OAuth client ids and payment keys.
  const cleaned = Object.fromEntries(
    Object.entries(source)
      .map(([k, v]) => [k, v?.trim()] as const)
      .filter(([, v]) => v !== undefined && v !== ''),
  );
  const parsed = ProductionEnv.safeParse(cleaned);
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
