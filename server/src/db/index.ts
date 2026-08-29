// better-sqlite3 pinned to 11.x: 12.x and 13.x require Node >=22 and segfault
// on this project's Node 21 runtime.
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

export function openDb(databasePath: string): Database.Database {
  // dirname(':memory:') resolves to '.', which mkdirSync would needlessly touch;
  // the in-memory path used by tests has no directory to create.
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  return db;
}
