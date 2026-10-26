import type { NextFunction, Request, Response } from 'express';
import {
  CLIENT_IP_HEADER,
  clientIpMiddleware,
  PROXY_SECRET_HEADER,
} from './client-ip';

const SECRET = 'a'.repeat(40);

function run(secret: string | undefined, headers: Record<string, string>) {
  const req = { headers: { ...headers }, ip: '10.0.0.1' } as unknown as Request;
  const next = jest.fn() as NextFunction;
  clientIpMiddleware(secret)(req, {} as Response, next);
  expect(next).toHaveBeenCalled();
  return req;
}

describe('clientIpMiddleware', () => {
  it('uses the visitor IP named by the web app', () => {
    const req = run(SECRET, {
      [CLIENT_IP_HEADER]: '203.0.113.7',
      [PROXY_SECRET_HEADER]: SECRET,
    });
    expect(req.ip).toBe('203.0.113.7');
    // The secret never reaches the rest of the app.
    expect(req.headers[PROXY_SECRET_HEADER]).toBeUndefined();
    expect(req.headers[CLIENT_IP_HEADER]).toBeUndefined();
  });

  it('ignores the header without the right secret', () => {
    expect(
      run(SECRET, {
        [CLIENT_IP_HEADER]: '203.0.113.7',
        [PROXY_SECRET_HEADER]: 'b'.repeat(40),
      }).ip,
    ).toBe('10.0.0.1');
    expect(run(SECRET, { [CLIENT_IP_HEADER]: '203.0.113.7' }).ip).toBe(
      '10.0.0.1',
    );
    expect(
      run(undefined, {
        [CLIENT_IP_HEADER]: '203.0.113.7',
        [PROXY_SECRET_HEADER]: SECRET,
      }).ip,
    ).toBe('10.0.0.1');
  });

  it('ignores values that are not IP addresses', () => {
    expect(
      run(SECRET, {
        [CLIENT_IP_HEADER]: 'not-an-ip',
        [PROXY_SECRET_HEADER]: SECRET,
      }).ip,
    ).toBe('10.0.0.1');
  });
});
