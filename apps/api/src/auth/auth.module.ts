import { Module } from '@nestjs/common';
import { throttlerModule } from '../redis/redis.module';
import { AuthController } from './auth.controller';
import { loadEnv } from '../config/env';
import {
  AdminGuard,
  AuthGuard,
  OptionalAuthGuard,
  VerifiedEmailGuard,
} from './auth.guard';
import { EmailVerificationService } from './email-verification.service';
import { createGoogleClient, GOOGLE_CLIENT } from './google';
import { GoogleAuthService } from './google-auth.service';
import { PasswordResetService } from './password-reset.service';
import { UsersService } from './users.service';

@Module({
  imports: [throttlerModule()],
  controllers: [AuthController],
  providers: [
    UsersService,
    PasswordResetService,
    EmailVerificationService,
    GoogleAuthService,
    { provide: GOOGLE_CLIENT, useFactory: () => createGoogleClient(loadEnv()) },
    VerifiedEmailGuard,
    AuthGuard,
    AdminGuard,
    OptionalAuthGuard,
  ],
  exports: [
    UsersService,
    AuthGuard,
    AdminGuard,
    OptionalAuthGuard,
    VerifiedEmailGuard,
  ],
})
export class AuthModule {}
