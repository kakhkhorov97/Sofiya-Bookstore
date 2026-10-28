import { Module } from '@nestjs/common';
import { throttlerModule } from '../redis/redis.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AdminBooksService } from './admin-books.service';
import { AdminController } from './admin.controller';
import { AdminPeopleService } from './admin-people.service';

@Module({
  imports: [AuthModule, AiModule, throttlerModule()],
  controllers: [AdminController],
  providers: [AdminBooksService, AdminPeopleService],
})
export class AdminModule {}
