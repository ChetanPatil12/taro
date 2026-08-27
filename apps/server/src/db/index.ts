import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type TaroDb = ReturnType<typeof createDb>;

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

/**
 * Opens (creating if needed) the SQLite database and applies pending
 * migrations. Pass ':memory:' for an ephemeral database in tests.
 */
export function createDb(databasePath: string) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  const sqlite = new Database(databasePath);
  try {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder });
    return db;
  } catch (err) {
    // Don't leak the native handle (and its file lock) if pragmas or
    // migrations throw — close first, then let the caller see the error.
    sqlite.close();
    throw err;
  }
}

export { schema };
