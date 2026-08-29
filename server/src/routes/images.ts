import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import type { ImageRecord, ImageRepository } from '../db/images';
import {
  BadRequestError,
  NotFoundError,
  PayloadTooLargeError,
  UnprocessableEntityError,
  UnsupportedMediaTypeError,
} from '../errors';
import type { VisionClient } from '../vision/types';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

const MAGIC_BYTES_HEADER_LENGTH = 12;

function matchesMagicBytes(mimeType: AllowedMimeType, header: Buffer): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case 'image/png':
      return header
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(header.toString('ascii', 0, 6));
    case 'image/webp':
      return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  }
}

async function readFileHeader(filePath: string, length: number): Promise<Buffer> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

// Excludes storagePath: the on-disk path is an implementation detail, not
// something the API should expose. Fetch bytes via GET /api/images/:id/file.
function toPublicImage(image: ImageRecord) {
  return {
    id: image.id,
    filename: image.filename,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    description: image.description,
    status: image.status,
    errorMessage: image.errorMessage,
    createdAt: image.createdAt,
  };
}

export interface ImageRoutesDeps {
  imageRepository: ImageRepository;
  visionClient: VisionClient;
  uploadDir: string;
}

export function registerImageRoutes(app: FastifyInstance, deps: ImageRoutesDeps): void {
  const { imageRepository, visionClient, uploadDir } = deps;

  async function describeImage(id: string, storagePath: string, mimeType: string): Promise<void> {
    try {
      const imageBase64 = (await readFile(storagePath)).toString('base64');
      const description = await visionClient.describe({ imageBase64, mimeType });
      imageRepository.markReady(id, description);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vision request failed.';
      imageRepository.markFailed(id, message);
    }
  }

  app.post('/api/images', async (request, reply) => {
    let file;
    try {
      file = await request.file();
    } catch {
      throw new BadRequestError('Malformed multipart request.');
    }

    if (!file) {
      throw new BadRequestError('No file uploaded. Send a multipart field named "file".');
    }

    if (!isAllowedMimeType(file.mimetype)) {
      throw new UnsupportedMediaTypeError(`Unsupported file type: ${file.mimetype}`);
    }
    const mimeType = file.mimetype;

    await mkdir(uploadDir, { recursive: true });
    const id = randomUUID();
    const storagePath = path.join(uploadDir, `${id}.${EXTENSION_BY_MIME[mimeType]}`);

    await pipeline(file.file, createWriteStream(storagePath));

    if (file.file.truncated) {
      await rm(storagePath, { force: true });
      throw new PayloadTooLargeError('File exceeds the maximum allowed size.');
    }

    const header = await readFileHeader(storagePath, MAGIC_BYTES_HEADER_LENGTH);
    if (!matchesMagicBytes(mimeType, header)) {
      await rm(storagePath, { force: true });
      throw new UnprocessableEntityError('File contents do not match the declared file type.');
    }

    const { size } = await stat(storagePath);
    const image = imageRepository.insertPending({
      id,
      filename: file.filename,
      storagePath,
      mimeType,
      sizeBytes: size,
    });

    const task = describeImage(image.id, storagePath, mimeType).finally(() => {
      app.pendingDescriptions.delete(task);
    });
    app.pendingDescriptions.add(task);

    reply.code(201);
    return { image: toPublicImage(image) };
  });

  app.get('/api/images', async () => {
    return { images: imageRepository.getAll().map(toPublicImage) };
  });

  app.get('/api/images/:id', async (request) => {
    const { id } = request.params as { id: string };
    const image = imageRepository.getById(id);
    if (!image) {
      throw new NotFoundError(`No image found with id ${id}`);
    }
    return { image: toPublicImage(image) };
  });

  app.get('/api/images/:id/file', async (request, reply) => {
    const { id } = request.params as { id: string };
    const image = imageRepository.getById(id);
    if (!image) {
      throw new NotFoundError(`No image found with id ${id}`);
    }

    try {
      await stat(image.storagePath);
    } catch {
      throw new NotFoundError(`No file on disk for image ${id}`);
    }

    reply.type(image.mimeType);
    return createReadStream(image.storagePath);
  });
}
