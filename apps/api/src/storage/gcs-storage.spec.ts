import type { Bucket } from '@google-cloud/storage';
import { GcsStorage } from './storage';

const KEY = 'covers/0b6f7c2e-5a4d-4e3f-8a9b-1c2d3e4f5a6b.webp';

// A stand-in for a Cloud Storage bucket, so the test needs no credentials.
function fakeBucket() {
  const files = new Map<string, Buffer>();
  const saved: { key: string; options: unknown }[] = [];
  const bucket = {
    file: (key: string) => ({
      save: (data: Buffer, options: unknown) => {
        files.set(key, data);
        saved.push({ key, options });
        return Promise.resolve();
      },
      download: () => {
        const data = files.get(key);
        return data
          ? Promise.resolve([data])
          : Promise.reject(
              Object.assign(new Error('No such object'), { code: 404 }),
            );
      },
      delete: () => {
        files.delete(key);
        return Promise.resolve();
      },
    }),
  };
  return { bucket: bucket as unknown as Bucket, files, saved };
}

describe('GcsStorage', () => {
  it('saves, reads and deletes covers', async () => {
    const { bucket, files, saved } = fakeBucket();
    const storage = new GcsStorage(bucket);
    await storage.put(KEY, Buffer.from('webp'), 'image/webp');
    expect(saved[0].options).toMatchObject({
      contentType: 'image/webp',
      resumable: false,
    });
    expect((await storage.get(KEY))?.toString()).toBe('webp');
    await storage.delete(KEY);
    expect(files.size).toBe(0);
  });

  it('returns null for a missing cover', async () => {
    expect(await new GcsStorage(fakeBucket().bucket).get(KEY)).toBeNull();
  });

  it('refuses keys outside the covers folder', async () => {
    const storage = new GcsStorage(fakeBucket().bucket);
    await expect(storage.get('../secrets.txt')).rejects.toThrow(
      /Invalid storage key/,
    );
  });
});
