import { isIP } from "node:net";

export const CLIENT_IP_HEADER = "x-sofiya-client-ip";
export const PROXY_SECRET_HEADER = "x-sofiya-proxy-secret";

// The visitor's IP from X-Forwarded-For. Google's front end appends the
// address it saw to whatever the browser sent, so the trustworthy entry is
// counted from the right: 1 for Cloud Run on its own, 2 behind an external
// load balancer (which appends its own address too). Anything to the left
// could be made up by the browser.
export function clientIpFrom(forwardedFor: string | null, hops = 1): string | null {
  if (!forwardedFor || hops < 1) return null;
  const parts = forwardedFor.split(",").map((p) => p.trim()).filter(Boolean);
  const ip = parts[parts.length - hops];
  return ip && isIP(ip) ? ip : null;
}
