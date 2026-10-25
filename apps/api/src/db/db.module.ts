import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { loadEnv } from '../config/env';
import { createDb } from './client';
import type { Db, DbHandle } from './client';

export const DB = Symbol('DB');
export const InjectDb = () => Inject(DB);

@Injectable()
export class DbLifecycle implements OnModuleDestroy {
  constructor(@Inject('DB_HANDLE') private readonly handle: DbHandle) {}

  async onModuleDestroy() {
    await this.handle.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: 'DB_HANDLE',
      useFactory: (): DbHandle => {
        const url = loadEnv().DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL is not set');
        return createDb(url);
      },
    },
    {
      provide: DB,
      useFactory: (handle: DbHandle): Db => handle.db,
      inject: ['DB_HANDLE'],
    },
    DbLifecycle,
  ],
  exports: [DB],
})
export class DbModule {}
