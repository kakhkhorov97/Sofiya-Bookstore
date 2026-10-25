import "server-only";
import type { PublicUser } from "@sofiya/shared";
import { redirect } from "next/navigation";
import { apiGetOrNull } from "./api";

export function getCurrentUser(): Promise<PublicUser | null> {
  return apiGetOrNull<PublicUser>("/me", { auth: true });
}

export async function requireUser(returnTo: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
  return user;
}
