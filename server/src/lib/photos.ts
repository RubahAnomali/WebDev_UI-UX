import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { config } from '../config.ts';
import { ApiError } from './errors.ts';

const ALLOWED = new Set(['jpeg', 'png', 'webp']);
const SIZES = [
  { suffix: 'lg', width: 1600 },
  { suffix: 'md', width: 800 },
  { suffix: 'sm', width: 320 },
] as const;

/** Storage abstraction so production can swap local disk for S3/R2. */
export interface PhotoStorage {
  put(key: string, data: Buffer): Promise<void>;
  removePrefix(key: string): Promise<void>;
}

export const localStorage: PhotoStorage = {
  async put(key, data) {
    const path = join(config.uploadDir, key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
  },
  async removePrefix(key) {
    // Keys are generated server-side (uuid segments only), never from user input.
    if (!/^listings\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)) return;
    await Promise.all(SIZES.map((s) => rm(join(config.uploadDir, `${key}-${s.suffix}.webp`), { force: true })));
  },
};

/**
 * Validates an uploaded image by decoding it (not by trusting the filename or
 * MIME type), auto-orients it, and re-encodes it to WebP at three sizes.
 * Re-encoding drops all metadata, including EXIF GPS location.
 */
export async function processPhoto(input: Buffer, key: string, storage: PhotoStorage = localStorage) {
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new ApiError('UNSUPPORTED_MEDIA', 'That file isn’t a supported image. Use a JPG, PNG, or WebP photo.');
  }
  if (!meta.format || !ALLOWED.has(meta.format)) {
    throw new ApiError('UNSUPPORTED_MEDIA', 'That file isn’t a supported image. Use a JPG, PNG, or WebP photo.');
  }
  if ((meta.width ?? 0) < 320 || (meta.height ?? 0) < 240) {
    throw new ApiError('VALIDATION', 'That photo is too small. Use an image at least 320 × 240 pixels.');
  }

  let largest = { width: 0, height: 0 };
  for (const size of SIZES) {
    const { data, info } = await sharp(input)
      .rotate()
      .resize({ width: size.width, height: size.width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    await storage.put(`${key}-${size.suffix}.webp`, data);
    if (size.suffix === 'lg') largest = { width: info.width, height: info.height };
  }
  return largest;
}
