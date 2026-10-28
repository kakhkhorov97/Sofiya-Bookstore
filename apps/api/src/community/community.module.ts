import { Module } from '@nestjs/common';
import { throttlerModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [AuthModule, throttlerModule()],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
