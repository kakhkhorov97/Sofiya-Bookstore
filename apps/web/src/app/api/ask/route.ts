import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from "@/lib/client-ip";

// Streams Ask Sofiya's server-sent events from the API to the browser.
// A route handler (not the /api rewrite) so the stream is passed through
// chunk by chunk and the visitor's IP reaches the API's rate limiter.
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? "http://localhost:8080/api";

export async function POST(req: Request) {
  // Only pages on this site may spend the AI budget.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return Response.json({ message: "Origin not allowed" }, { status: 403 });
  }

  // In production the middleware has added the visitor's IP and the proxy
  // secret to this request (see src/middleware.ts); pass both on. Locally the
  // API trusts X-Forwarded-For from this machine instead.
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const name of [CLIENT_IP_HEADER, PROXY_SECRET_HEADER, "x-forwarded-for"]) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }
  const upstream = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers,
    body: await req.text(),
    signal: req.signal,
  }).catch(() => null);

  if (!upstream) {
    return Response.json({ message: "Ask Sofiya is unavailable right now." }, { status: 502 });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
