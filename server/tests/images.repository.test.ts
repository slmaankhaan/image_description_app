import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../src/db/index';
import { ImageRepository } from '../src/db/images';

describe('ImageRepository', () => {
  let db: Database.Database;
  let repo: ImageRepository;

  beforeEach(() => {
    db = openDb(':memory:');
    repo = new ImageRepository(db);
  });

  it('round-trips an image from pending to ready', () => {
    const created = repo.insertPending({
      filename: 'cat.png',
      storagePath: 'data/uploads/cat.png',
      mimeType: 'image/png',
      sizeBytes: 1234,
    });

    expect(created.status).toBe('pending');
    expect(created.description).toBeNull();

    repo.markReady(created.id, 'A cat sitting on a windowsill.');

    const updated = repo.getById(created.id);
    expect(updated?.status).toBe('ready');
    expect(updated?.description).toBe('A cat sitting on a windowsill.');
  });

  it('markFailed sets status and error_message', () => {
    const created = repo.insertPending({
      filename: 'dog.jpg',
      storagePath: 'data/uploads/dog.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 5678,
    });

    repo.markFailed(created.id, 'vision service unavailable');

    const updated = repo.getById(created.id);
    expect(updated?.status).toBe('failed');
    expect(updated?.errorMessage).toBe('vision service unavailable');
  });
});
