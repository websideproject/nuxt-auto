import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as baseSchema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

export function useDB() {
  if (!_db) {
    const sqlite = new Database('.data/db.sqlite');
    _db = drizzle(sqlite, {
      schema: {
        ...baseSchema.schema,
      }
    });
  }
  return _db;
}
