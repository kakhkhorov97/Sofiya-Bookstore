import "server-only";
import { cookies } from "next/headers";

// Server-side calls go straight to the NestJS service.
const API_URL = process.env.API_URL ?? "http://localhost:8080/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  // Forward the visitor's session cookie (for /me, /orders, ...).
  auth?: boolean;
  // Seconds to cache public catalogue data; omit for no caching.
  revalidate?: number;
}

export async function apiGet<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.auth) {
    const session = (await cookies()).get("sofiya_session");
    if (session) headers.cookie = `sofiya_session=${session.value}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    headers,
    ...(opts.revalidate && !opts.auth
      ? { next: { revalidate: opts.revalidate } }
      : { cache: "no-store" as const }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return (await res.json()) as T;
}

// Returns null instead of throwing when the visitor is signed out.
export async function apiGetOrNull<T>(path: string, opts: Options = {}): Promise<T | null> {
  try {
    return await apiGet<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return null;
    throw err;
  }
}
