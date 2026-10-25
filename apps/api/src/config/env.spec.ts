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

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'not a url' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
