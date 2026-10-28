import "server-only";
import type { AuthProviders } from "@sofiya/shared";
import { apiGet } from "./api";

export const getAuthProviders = (): Promise<AuthProviders> =>
  apiGet<AuthProviders>("/auth/providers", { revalidate: 300 }).catch(() => ({ google: false }));
