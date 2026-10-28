import { createHash, randomBytes } from 'node:crypto';

// One-time link tokens (password reset, email confirmation): the token goes
// in the emailed link, only its SHA-256 hash is stored.
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
