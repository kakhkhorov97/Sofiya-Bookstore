import type { Bucket } from '@google-cloud/storage';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface FileStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

// Keys look like "covers/<uuid>.webp"; anything else is refused, so a key
// can never point outside the storage folder.
export const COVER_KEY = /^covers\/[0-9a-f-]{36}\.webp$/;

export class LocalDiskStorage implements FileStorage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!COVER_KEY.test(key)) throw new Error(`Invalid storage key: ${key}`);
    return path.join(this.root, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

// Cloud Run's disk is temporary and per instance, so production keeps
// covers in a private Cloud Storage bucket. The API serves them at
// /api/covers/:file (browsers cache them forever), so the bucket never
// needs to be public. Credentials come from the Cloud Run service account.
export class GcsStorage implements FileStorage {
  constructor(private readonly bucket: Bucket) {}

  private file(key: string) {
    if (!COVER_KEY.test(key)) throw new Error(`Invalid storage key: ${key}`);
    return this.bucket.file(key);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.file(key).save(data, {
      resumable: false,
      contentType,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const [data] = await this.file(key).download();
      return data;
    } catch (err) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.file(key).delete({ ignoreNotFound: true });
  }
}

// Public URL of a cover; the web app forwards /api/* to the API.
export const coverUrl = (key: string | null): string | null =>
  key ? `/api/${key}` : null;
