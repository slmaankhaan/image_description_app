import type { Database } from 'better-sqlite3';

export type ImageStatus = 'pending' | 'ready' | 'failed';

export interface ImageRecord {
  id: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  status: ImageStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface NewImage {
  id: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

interface ImageRow {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  description: string | null;
  status: ImageStatus;
  error_message: string | null;
  created_at: string;
}

function toRecord(row: ImageRow): ImageRecord {
  return {
    id: row.id,
    filename: row.filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    description: row.description,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export class ImageRepository {
  constructor(private readonly db: Database) {}

  // Takes the id from the caller rather than generating one here: the route
  // needs it up front to name the file on disk before this insert happens,
  // and the row must use that same id or storagePath and id would diverge.
  insertPending(image: NewImage): ImageRecord {
    this.db
      .prepare(
        `INSERT INTO images (id, filename, storage_path, mime_type, size_bytes, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(image.id, image.filename, image.storagePath, image.mimeType, image.sizeBytes);
    return this.getById(image.id)!;
  }

  markReady(id: string, description: string): void {
    this.db
      .prepare(`UPDATE images SET status = 'ready', description = ? WHERE id = ?`)
      .run(description, id);
  }

  markFailed(id: string, errorMessage: string): void {
    this.db
      .prepare(`UPDATE images SET status = 'failed', error_message = ? WHERE id = ?`)
      .run(errorMessage, id);
  }

  getById(id: string): ImageRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM images WHERE id = ?`).get(id) as
      | ImageRow
      | undefined;
    return row ? toRecord(row) : undefined;
  }

  // No LIMIT/offset: pagination is explicitly out of scope for this project.
  getAll(): ImageRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM images ORDER BY created_at DESC`)
      .all() as ImageRow[];
    return rows.map(toRecord);
  }
}
