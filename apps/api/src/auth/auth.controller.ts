import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
  UpdateProfileInput,
} from '@sofiya/shared';
import type { PublicUser } from '@sofiya/shared';
import type { Response } from 'express';
import { ZodPipe } from '../common/zod.pipe';
import { loadEnv } from '../config/env';
import { AuthGuard, CurrentUser } from './auth.guard';
import type { SessionUser } from './auth.guard';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from './session';
import { PasswordResetService } from './password-reset.service';
import { toPublicUser, UsersService } from './users.service';

const env = loadEnv();

@Controller()
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  private startSession(res: Response, userId: string) {
    res.cookie(
      SESSION_COOKIE,
      signSession(env, userId),
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
    return toPublicUser(user);
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
