import "server-only";
import type { PublicUser } from "@sofiya/shared";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { apiGetOrNull } from "./api";

// Cached per request, so the layout and pages share one /me call.
export const getCurrentUser = cache((): Promise<PublicUser | null> =>
  apiGetOrNull<PublicUser>("/me", { auth: true }).catch(() => null),
);

export async function requireUser(returnTo: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
  return user;
}

// Admin pages answer 404 to everyone else, so they do not even reveal that
// an admin area exists.
export async function requireAdmin(returnTo: string): Promise<PublicUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "ADMIN") notFound();
  return user;
}
