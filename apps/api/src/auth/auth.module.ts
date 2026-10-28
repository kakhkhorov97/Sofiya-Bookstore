import { Module } from '@nestjs/common';
import { throttlerModule } from '../redis/redis.module';
import { AuthController } from './auth.controller';
import { AdminGuard, AuthGuard, OptionalAuthGuard } from './auth.guard';
import { PasswordResetService } from './password-reset.service';
import { UsersService } from './users.service';

@Module({
  imports: [throttlerModule()],
  controllers: [AuthController],
  providers: [
    UsersService,
    PasswordResetService,
    AuthGuard,
    AdminGuard,
    OptionalAuthGuard,
  ],
  exports: [UsersService, AuthGuard, AdminGuard, OptionalAuthGuard],
})
export class AuthModule {}
