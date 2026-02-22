import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as baseSchema from './schema'
import * as blogSchema from '../../modules/blog/schema'
import * as apiTokenSchema from '../../modules/api-tokens/schema'

let _db: ReturnType<typeof drizzle> | null = null

export function useDB() {
  if (!_db) {
    const sqlite = new Database('.data/db.sqlite')
    // Merge schemas from base and blog module
    _db = drizzle(sqlite, {
      schema: {
        ...baseSchema.schema,
        ...blogSchema,
        ...apiTokenSchema,
      }
    })
  }
  return _db
}
