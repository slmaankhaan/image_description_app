import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { openDb } from '../src/db';
import { ImageRepository } from '../src/db/images';
import { createFakeVisionClient, type FakeVisionClientOptions } from '../src/vision/fake-client';

// Smallest possible valid PNG (1x1, transparent) - used to exercise the real
// magic-byte check without committing a binary fixture file.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const BOUNDARY = '----vitest-boundary';

interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  content: Buffer | string;
}

function buildMultipartBody(parts: MultipartPart[]): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    let header = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) {
      header += `; filename="${part.filename}"`;
    }
    header += '\r\n';
    if (part.contentType) {
      header += `Content-Type: ${part.contentType}\r\n`;
    }
    header += '\r\n';

    chunks.push(Buffer.from(header));
    chunks.push(typeof part.content === 'string' ? Buffer.from(part.content) : part.content);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

describe('POST /api/images', () => {
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'image-app-test-'));
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  function buildTestApp(visionOptions: FakeVisionClientOptions = {}): FastifyInstance {
    const db = openDb(':memory:');
    const imageRepository = new ImageRepository(db);
    const visionClient = createFakeVisionClient(visionOptions);
    return buildApp({
      imageRepository,
      visionClient,
      uploadDir,
      maxFileSizeBytes: 10 * 1024 * 1024,
    });
  }

  it('returns 400 when no file is uploaded', async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/images',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: buildMultipartBody([{ name: 'note', content: 'no file here' }]),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('BAD_REQUEST');
  });

  it('returns 415 for a disallowed MIME type', async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/images',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: buildMultipartBody([
        { name: 'file', filename: 'notes.txt', contentType: 'text/plain', content: 'hello world' },
      ]),
    });

    expect(response.statusCode).toBe(415);
    expect(JSON.parse(response.body).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('accepts a valid PNG as 201 pending, then settles to ready', async () => {
    const app = buildTestApp({ description: 'A tiny test image.', delayMs: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/images',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: buildMultipartBody([
        {
          name: 'file',
          filename: 'tiny.png',
          contentType: 'image/png',
          content: Buffer.from(TINY_PNG_BASE64, 'base64'),
        },
      ]),
    });

    expect(response.statusCode).toBe(201);
    const created = JSON.parse(response.body).image;
    expect(created.status).toBe('pending');
    expect(created.description).toBeNull();

    // Wait for the fire-and-forget description task instead of sleeping an
    // arbitrary amount - the route exposes in-flight tasks for exactly this.
    await Promise.all(app.pendingDescriptions);

    const getResponse = await app.inject({ method: 'GET', url: `/api/images/${created.id}` });
    const fetched = JSON.parse(getResponse.body).image;
    expect(fetched.status).toBe('ready');
    expect(fetched.description).toBe('A tiny test image.');
  });
});
