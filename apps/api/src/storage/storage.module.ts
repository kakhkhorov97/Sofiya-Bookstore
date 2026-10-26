import {
  Controller,
  Get,
  Global,
  Inject,
  Module,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import path from 'node:path';
import { loadEnv } from '../config/env';
import { Storage } from '@google-cloud/storage';
import {
  COVER_KEY,
  FILE_STORAGE,
  GcsStorage,
  LocalDiskStorage,
} from './storage';
import type { FileStorage } from './storage';

@Controller('covers')
export class CoversController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Get(':file')
  async get(@Param('file') file: string, @Res() res: Response): Promise<void> {
    const key = `covers/${file}`;
    if (!COVER_KEY.test(key)) throw new NotFoundException();
    const data = await this.storage.get(key);
    if (!data) throw new NotFoundException();
    res.setHeader('Content-Type', 'image/webp');
    // Keys are random and never reused, so covers can be cached forever.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(data);
  }
}

@Global()
@Module({
  controllers: [CoversController],
  providers: [
    {
      provide: FILE_STORAGE,
      useFactory: (): FileStorage => {
        const env = loadEnv();
        if (env.STORAGE_DRIVER === 'gcs') {
          return new GcsStorage(new Storage().bucket(env.GCS_BUCKET!));
        }
        return new LocalDiskStorage(
          path.resolve(process.cwd(), env.UPLOADS_DIR),
        );
      },
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
