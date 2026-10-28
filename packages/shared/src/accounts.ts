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

// "Forgot password": always answered the same way, whether or not the
// email has an account, so the form cannot be used to find members.
export const ForgotPasswordInput = z.object({ email: Email }).strict();
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInput>;

export const ResetPasswordInput = z
  .object({ token: z.string().min(20).max(200), password: Password })
  .strict();
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;
