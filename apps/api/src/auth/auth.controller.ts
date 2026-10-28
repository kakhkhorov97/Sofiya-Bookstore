import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ChangePasswordInput,
  ConfirmEmailInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
  UpdateProfileInput,
} from '@sofiya/shared';
import type { AuthProviders, PublicUser } from '@sofiya/shared';
import type { Request, Response } from 'express';
import { ZodPipe } from '../common/zod.pipe';
import { loadEnv, webUrl } from '../config/env';
import { AuthGuard, CurrentUser } from './auth.guard';
import type { SessionUser } from './auth.guard';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from './session';
import { EmailVerificationService } from './email-verification.service';
import {
  GOOGLE_STATE_COOKIE,
  GoogleAuthService,
  GoogleSignInError,
} from './google-auth.service';
import { PasswordResetService } from './password-reset.service';
import { toPublicUser, UsersService } from './users.service';

const env = loadEnv();

@Controller()
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly passwordReset: PasswordResetService,
    private readonly verification: EmailVerificationService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  private startSession(res: Response, userId: string, issuedAt?: number) {
    res.cookie(
      SESSION_COOKIE,
      signSession(env, userId, issuedAt),
      sessionCookieOptions(env),
    );
  }

  @Post('auth/signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: env.AUTH_RATE_LIMIT, ttl: 60_000 } })
  async signUp(
    @Body(new ZodPipe(SignUpInput)) input: SignUpInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const user = await this.users.signUp(input);
    this.startSession(res, user.id);
    const verified = await this.verification.start(user);
    return { ...toPublicUser(user), emailVerified: verified };
  }

  @Post('auth/signin')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: env.AUTH_RATE_LIMIT, ttl: 60_000 } })
  async signIn(
    @Body(new ZodPipe(SignInInput)) input: SignInInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const user = await this.users.signIn(input);
    this.startSession(res, user.id);
    return toPublicUser(user);
  }

  @Get('auth/providers')
  providers(): AuthProviders {
    return { google: this.googleAuth.enabled };
  }

  // ---- Email confirmation ------------------------------------------------

  @Post('auth/email/confirm')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: env.AUTH_RATE_LIMIT, ttl: 60_000 } })
  async confirmEmail(
    @Body(new ZodPipe(ConfirmEmailInput)) input: ConfirmEmailInput,
  ): Promise<{ confirmed: true }> {
    await this.verification.confirm(input.token);
    return { confirmed: true };
  }

  @Post('auth/email/resend')
  @HttpCode(202)
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: env.AUTH_RATE_LIMIT, ttl: 60_000 } })
  async resendConfirmation(
    @CurrentUser() user: SessionUser,
  ): Promise<{ sent: true }> {
    await this.verification.start(user);
    return { sent: true };
  }

  // ---- Continue with Google ---------------------------------------------

  // Plain links, not fetch calls: the browser itself visits Google.
  @Get('auth/google')
  googleStart(
    @Query('next') next: string | undefined,
    @Res() res: Response,
  ): void {
    if (!this.googleAuth.enabled) throw new NotFoundException();
    const { url, cookie, maxAgeMs } = this.googleAuth.start(next);
    res.cookie(GOOGLE_STATE_COOKIE, cookie, {
      httpOnly: true,
      // Lax: the cookie must come back on Google's top-level redirect.
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/api/auth/google',
      maxAge: maxAgeMs,
    });
    res.redirect(302, url);
  }

  @Get('auth/google/callback')
  async googleCallback(
    @Query() query: Record<string, string | undefined>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.googleAuth.enabled) throw new NotFoundException();
    const cookies = req.cookies as Record<string, string> | undefined;
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/api/auth/google' });
    const site = webUrl(env);
    try {
      const { user, next } = await this.googleAuth.finish({
        code: query.code,
        state: query.state,
        error: query.error,
        cookie: cookies?.[GOOGLE_STATE_COOKIE],
      });
      this.startSession(res, user.id);
      res.redirect(302, `${site}${next}`);
    } catch (err) {
      const reason = err instanceof GoogleSignInError ? err.reason : 'failed';
      res.redirect(302, `${site}/signin?google=${reason}`);
    }
  }

  // 202 whether or not the email has an account.
  @Post('auth/password/forgot')
  @HttpCode(202)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: env.AUTH_RATE_LIMIT, ttl: 60_000 } })
  async forgotPassword(
    @Body(new ZodPipe(ForgotPasswordInput)) input: ForgotPasswordInput,
  ): Promise<{ sent: true }> {
    await this.passwordReset.request(input.email);
    return { sent: true };
  }

  @Post('auth/password/reset')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: env.AUTH_RATE_LIMIT, ttl: 60_000 } })
  async resetPassword(
    @Body(new ZodPipe(ResetPasswordInput)) input: ResetPasswordInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ reset: true }> {
    await this.passwordReset.reset(input.token, input.password);
    // Whatever session this browser had is now invalid; drop the cookie.
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { reset: true };
  }

  @Post('auth/signout')
  @HttpCode(204)
  signOut(@Res({ passthrough: true }) res: Response): void {
    const { maxAge: _maxAge, ...opts } = sessionCookieOptions(env);
    void _maxAge;
    res.clearCookie(SESSION_COOKIE, opts);
  }

  @Patch('me/password')
  @HttpCode(204)
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: env.AUTH_RATE_LIMIT, ttl: 60_000 } })
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(ChangePasswordInput)) input: ChangePasswordInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cutoff = await this.users.changePassword(user, input);
    // Other devices are signed out; this browser gets a fresh session.
    this.startSession(res, user.id, cutoff);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: SessionUser): PublicUser {
    return toPublicUser(user);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  async updateMe(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(UpdateProfileInput)) input: UpdateProfileInput,
  ): Promise<PublicUser> {
    return toPublicUser(await this.users.updateProfile(user.id, input));
  }
}
