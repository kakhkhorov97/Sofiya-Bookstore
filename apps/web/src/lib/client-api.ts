// Browser-side calls go to /api/* on this site, which Next.js forwards to
// the API. The session cookie travels automatically.
export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function clientApi<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const issues = body.issues as { message: string }[] | undefined;
    const message =
      issues?.[0]?.message ?? (typeof body.message === "string" ? body.message : "Something went wrong. Please try again.");
    throw new ClientApiError(res.status, message, body);
  }
  return body as T;
}

// Multipart upload (covers, AI drafts). The browser sets the boundary.
export async function clientUpload<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  const res = await fetch(`/api${path}`, { method, body: form, credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const issues = body.issues as { message: string }[] | undefined;
    const message =
      res.status === 413
        ? "That file is too large. Use an image under 5 MB."
        : (issues?.[0]?.message ?? (typeof body.message === "string" ? body.message : "Upload failed. Please try again."));
    throw new ClientApiError(res.status, message, body);
  }
  return body as T;
}
