import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as baseSchema from './schema.js'

// Extract the schema object type
type Schema = typeof baseSchema.schema
let _db: BetterSQLite3Database<Schema> | null = null

export function useDB() {
  if (!_db) {
    const sqlite = new Database('.data/db.sqlite')
    _db = drizzle(sqlite, {
      schema: {
        ...baseSchema.schema,
      }
    })
  }
  return _db
}
