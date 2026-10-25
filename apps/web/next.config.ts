import path from "node:path";
import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8080/api";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Cloud Run container.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
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
