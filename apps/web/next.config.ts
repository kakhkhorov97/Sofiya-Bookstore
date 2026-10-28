import path from "node:path";
import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8080/api";
const production = process.env.NODE_ENV === "production";

// Sent with every page. The CSP only covers what cannot break checkout:
// Toss loads its payment window and card-company pages from many domains,
// so scripts and frames are not restricted here (see README, Security).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", ...(production ? ["upgrade-insecure-requests"] : [])].join("; "),
  },
  // Browsers only ever use HTTPS for the site once they have seen it (production).
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Cloud Run container.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The browser only ever talks to this site; /api/* is forwarded to the
  // NestJS service. That keeps the session cookie first-party (SameSite=Lax).
  // Route handlers in src/app/api (like /api/health) take priority.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }],
    };
  },
};

export default nextConfig;
