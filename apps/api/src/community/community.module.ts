import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [AuthModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
