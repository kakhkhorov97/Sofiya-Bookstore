import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { loadEnv, type Env } from '../config/env';
import type { users } from '../db/schema';
import { SESSION_COOKIE, verifySession } from './session';
import { UsersService } from './users.service';

export type SessionUser = typeof users.$inferSelect;

interface AuthedRequest extends Request {
  user?: SessionUser;
}

// The signed-in, active user for this request, or null. A session issued
// before the user's sessions_valid_after (a password reset) no longer counts.
async function sessionUser(
  env: Env,
  usersService: UsersService,
  req: AuthedRequest,
): Promise<SessionUser | null> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[SESSION_COOKIE];
  const session = token ? verifySession(env, token) : null;
  if (!session) return null;
  const user = await usersService.findActive(session.userId);
  if (!user) return null;
  if (
    user.sessionsValidAfter &&
    session.issuedAt < user.sessionsValidAfter.getTime()
  ) {
    return null;
  }
  return user;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly env = loadEnv();

  constructor(private readonly usersService: UsersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = await sessionUser(this.env, this.usersService, req);
    if (!user) throw new UnauthorizedException('Please sign in first');
    req.user = user;
    return true;
  }
}

// Like AuthGuard, but never blocks: attaches the user when signed in.
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  private readonly env = loadEnv();

  constructor(private readonly usersService: UsersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = await sessionUser(this.env, this.usersService, req);
    if (user) req.user = user;
    return true;
  }
}

export const OptionalUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser | null =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user ?? null,
);

// Use after AuthGuard: @UseGuards(AuthGuard, AdminGuard)
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Admins only');
    }
    return true;
  }
}

// Use after AuthGuard on actions that need a confirmed address (ordering,
// reviewing). The code lets the website show "confirm your email" instead
// of a generic error.
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user?.emailVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message:
          'Please confirm your email first: we sent you a link when you signed up.',
      });
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new UnauthorizedException('Please sign in first');
    return user;
  },
);
