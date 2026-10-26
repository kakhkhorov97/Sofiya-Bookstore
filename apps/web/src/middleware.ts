import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_IP_HEADER, clientIpFrom, PROXY_SECRET_HEADER } from "@/lib/client-ip";

// Runs on /api/* before Next forwards it to the API. On Cloud Run the API
// would otherwise see this server's address for every visitor, so we name
// the visitor's IP and prove it with PROXY_SECRET (the API checks it; see
// apps/api/src/common/client-ip.ts). Headers a browser sends with these
// names are always dropped.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);

  const secret = process.env.PROXY_SECRET;
  const ip = clientIpFrom(req.headers.get("x-forwarded-for"), Number(process.env.CLIENT_IP_HOPS ?? 1));
  if (secret && ip) {
    headers.set(CLIENT_IP_HEADER, ip);
    headers.set(PROXY_SECRET_HEADER, secret);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
  // Node.js runtime: reads PROXY_SECRET when the container starts, not at build.
  runtime: "nodejs",
};
