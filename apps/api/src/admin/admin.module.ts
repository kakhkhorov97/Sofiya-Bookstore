import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AdminBooksService } from './admin-books.service';
import { AdminController } from './admin.controller';
import { AdminPeopleService } from './admin-people.service';

@Module({
  imports: [
    AuthModule,
    AiModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [AdminController],
  providers: [AdminBooksService, AdminPeopleService],
})
export class AdminModule {}
