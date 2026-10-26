import { Logger, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { loadEnv } from '../config/env';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { IndexJobService } from './index-job.service';
import { AI_PROVIDER, createProvider } from './provider';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [AskController],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: () => {
        const provider = createProvider(loadEnv());
        new Logger('AiModule').log(
          provider
            ? `AI provider: ${provider.name}`
            : 'AI features are off (no GEMINI_API_KEY)',
        );
        return provider;
      },
    },
    RetrievalService,
    AskService,
    IndexJobService,
  ],
  exports: [RetrievalService, IndexJobService, AI_PROVIDER],
})
export class AiModule {}
