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

  const forwardedFor = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const upstream = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}) },
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
