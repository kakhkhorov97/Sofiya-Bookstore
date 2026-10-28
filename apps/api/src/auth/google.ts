import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import type { Env } from '../config/env';

export const GOOGLE_CLIENT = Symbol('GOOGLE_CLIENT');

export interface GoogleProfile {
  sub: string; // Google's stable account id
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleClient {
  authUrl(input: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string;
  // Exchanges the code for tokens and returns the verified ID token's claims.
  profile(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<GoogleProfile>;
}

// Authorization code flow with PKCE, done on the server: the browser only
// ever sees Google's sign-in page and our redirect. The ID token's signature,
// audience and expiry are checked by google-auth-library.
export class RealGoogleClient implements GoogleClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private client(redirectUri: string) {
    return new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri,
    });
  }

  authUrl(input: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string {
    return this.client(input.redirectUri).generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    });
  }

  async profile(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<GoogleProfile> {
    const client = this.client(input.redirectUri);
    const { tokens } = await client.getToken({
      code: input.code,
      codeVerifier: input.codeVerifier,
    });
    if (!tokens.id_token) throw new Error('Google returned no ID token');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email)
      throw new Error('Google returned no account id or email');
    return {
      sub: p.sub,
      email: p.email.toLowerCase(),
      emailVerified: p.email_verified === true,
      name: p.name ?? null,
    };
  }
}

// Tests: codes look like "fake:<sub>:<email>:<verified true|false>:<name>".
export class FakeGoogleClient implements GoogleClient {
  authUrl(input: { state: string; redirectUri: string }): string {
    return `https://accounts.google.test/auth?state=${encodeURIComponent(input.state)}&redirect_uri=${encodeURIComponent(input.redirectUri)}`;
  }

  profile(input: { code: string }): Promise<GoogleProfile> {
    const [kind, sub, email, verified, name] = input.code.split(':');
    if (kind !== 'fake' || !sub || !email)
      return Promise.reject(new Error('invalid code'));
    return Promise.resolve({
      sub,
      email: email.toLowerCase(),
      emailVerified: verified === 'true',
      name: name || null,
    });
  }
}

export function createGoogleClient(env: Env): GoogleClient | null {
  if (env.GOOGLE_AUTH === 'fake') return new FakeGoogleClient();
  return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? new RealGoogleClient(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    : null;
}
