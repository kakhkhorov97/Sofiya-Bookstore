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

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'not a url' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
