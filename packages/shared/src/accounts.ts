import { z } from "zod";
import { UserRole } from "./domain";

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const Password = z.string().min(8, "Use at least 8 characters").max(128);
const DisplayName = z.string().trim().min(1).max(60);

// Only these fields can be set at sign-up; role, status and points are
// never accepted from the client (legacy defect: mass assignment).
export const SignUpInput = z
  .object({ email: Email, password: Password, displayName: DisplayName })
  .strict();
export type SignUpInput = z.infer<typeof SignUpInput>;

export const SignInInput = z
  .object({ email: Email, password: z.string().min(1).max(128) })
  .strict();
export type SignInInput = z.infer<typeof SignInInput>;

export const UpdateProfileInput = z.object({ displayName: DisplayName }).strict();
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  points: number;
  createdAt: string;
}
