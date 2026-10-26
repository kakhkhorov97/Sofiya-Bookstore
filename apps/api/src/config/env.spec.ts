import { allowedOrigins, loadEnv } from './env';

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(8080);
    expect(allowedOrigins(env)).toEqual(['http://localhost:3000']);
  });

  it('splits and trims allowed origins', () => {
    const env = loadEnv({
      WEB_ORIGINS: 'https://sofiya.example, http://localhost:3000',
    });
    expect(allowedOrigins(env)).toEqual([
      'https://sofiya.example',
      'http://localhost:3000',
    ]);
  });

  it('treats blank values as unset (as in .env.example)', () => {
    const env = loadEnv({ GEMINI_API_KEY: '', DATABASE_URL: '  ', PORT: '' });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.PORT).toBe(8080);
  });

  it('refuses to start production without secrets and cloud storage', () => {
    const prod = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db.example/sofiya',
      AUTH_SECRET: 's'.repeat(40),
      PROXY_SECRET: 'p'.repeat(40),
      STORAGE_DRIVER: 'gcs',
      GCS_BUCKET: 'sofiya-covers',
    };
    expect(loadEnv(prod).STORAGE_DRIVER).toBe('gcs');
    expect(() => loadEnv({ ...prod, STORAGE_DRIVER: 'local' })).toThrow(
      /STORAGE_DRIVER/,
    );
    expect(() => loadEnv({ ...prod, GCS_BUCKET: '' })).toThrow(/GCS_BUCKET/);
    expect(() => loadEnv({ ...prod, AUTH_SECRET: '' })).toThrow(/AUTH_SECRET/);
    expect(() => loadEnv({ ...prod, PROXY_SECRET: '' })).toThrow(
      /PROXY_SECRET/,
    );
    // Development keeps working with local covers and no proxy secret.
    expect(loadEnv({}).STORAGE_DRIVER).toBe('local');
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'not a url' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
