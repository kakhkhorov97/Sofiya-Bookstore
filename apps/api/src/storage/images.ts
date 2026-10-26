import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  contentType: 'image/webp';
}

// Decodes and re-encodes every upload. Whatever the browser claimed, only a
// real image survives; EXIF (camera, GPS) is dropped and the size is capped.
export async function processCover(input: Buffer): Promise<ProcessedImage> {
  try {
    const image = sharp(input, {
      limitInputPixels: MAX_PIXELS,
      failOn: 'error',
    });
    const meta = await image.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
      throw new Error(`unsupported format ${meta.format ?? 'unknown'}`);
    }
    const { data, info } = await image
      .rotate() // respect the camera's orientation before EXIF is stripped
      .resize({
        width: 900,
        height: 1350,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      contentType: 'image/webp',
    };
  } catch {
    throw new BadRequestException(
      'Upload a JPEG, PNG or WebP image (up to 5 MB).',
    );
  }
}
