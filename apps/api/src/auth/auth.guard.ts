import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { loadEnv } from '../config/env';
import type { users } from '../db/schema';
import { SESSION_COOKIE, verifySession } from './session';
import { UsersService } from './users.service';

export type SessionUser = typeof users.$inferSelect;

interface AuthedRequest extends Request {
  user?: SessionUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly env = loadEnv();

  constructor(private readonly usersService: UsersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    const userId = token ? verifySession(this.env, token) : null;
    const user = userId ? await this.usersService.findActive(userId) : null;
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
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    const userId = token ? verifySession(this.env, token) : null;
    const user = userId ? await this.usersService.findActive(userId) : null;
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

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new UnauthorizedException('Please sign in first');
    return user;
  },
);
