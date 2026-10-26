import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export const CLIENT_IP_HEADER = 'x-sofiya-client-ip';
export const PROXY_SECRET_HEADER = 'x-sofiya-proxy-secret';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// On Cloud Run every browser request reaches the API through the web app,
// so Express sees the web server's address for everyone and one visitor
// could exhaust the rate limits for all. The web app names the visitor's
// IP in X-Sofiya-Client-Ip and proves it is the web app with the shared
// PROXY_SECRET. Without a matching secret the header is ignored, so nobody
// calling the API directly can pick their own IP. Both headers are removed
// before anything else sees them.
export function clientIpMiddleware(secret: string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ip = req.headers[CLIENT_IP_HEADER];
    const given = req.headers[PROXY_SECRET_HEADER];
    delete req.headers[CLIENT_IP_HEADER];
    delete req.headers[PROXY_SECRET_HEADER];
    if (
      secret &&
      typeof given === 'string' &&
      typeof ip === 'string' &&
      isIP(ip) &&
      sameSecret(given, secret)
    ) {
      // req.ip is what the throttler keys on.
      Object.defineProperty(req, 'ip', { value: ip, configurable: true });
    }
    next();
  };
}
