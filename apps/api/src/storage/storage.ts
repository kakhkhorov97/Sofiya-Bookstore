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

// Public URL of a cover; the web app forwards /api/* to the API.
export const coverUrl = (key: string | null): string | null =>
  key ? `/api/${key}` : null;
