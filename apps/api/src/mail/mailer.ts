import { Logger } from '@nestjs/common';
import type { Env } from '../config/env';

export const MAILER = Symbol('MAILER');

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

// Resend's HTTP API (resend.com). The sender domain must be verified there;
// onboarding@resend.dev works for testing but only delivers to your own address.
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(email: Email): Promise<void> {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, ...email }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(
        `Resend refused the email (${res.status}): ${body.message ?? 'no details'}`,
      );
    }
  }
}

// Local development: emails are printed in the API's terminal instead of sent.
export class LogMailer implements Mailer {
  private readonly logger = new Logger('Email');

  send(email: Email): Promise<void> {
    this.logger.log(`To ${email.to}: ${email.subject}\n${email.text}`);
    return Promise.resolve();
  }
}

// Tests read what would have been sent.
export class MemoryMailer implements Mailer {
  readonly sent: Email[] = [];

  send(email: Email): Promise<void> {
    this.sent.push(email);
    return Promise.resolve();
  }
}

// null = email is switched off (password reset unavailable, no order emails).
export function createMailer(env: Env): Mailer | null {
  const provider =
    env.EMAIL_PROVIDER ?? (env.NODE_ENV === 'production' ? 'off' : 'log');
  switch (provider) {
    case 'resend':
      return new ResendMailer(env.RESEND_API_KEY!, env.EMAIL_FROM);
    case 'log':
      return new LogMailer();
    case 'memory':
      return new MemoryMailer();
    default:
      return null;
  }
}
