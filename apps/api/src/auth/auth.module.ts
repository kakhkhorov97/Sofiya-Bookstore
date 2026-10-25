import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AdminGuard, AuthGuard } from './auth.guard';
import { UsersService } from './users.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [AuthController],
  providers: [UsersService, AuthGuard, AdminGuard],
  exports: [UsersService, AuthGuard, AdminGuard],
})
export class AuthModule {}
