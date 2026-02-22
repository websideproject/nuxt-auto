import type { DatabaseEngine, DatabaseAdapter } from '../../../types/database'
import { createSqliteAdapter } from './sqlite'
import { createPostgresAdapter } from './postgres'
import { createMysqlAdapter } from './mysql'
import { createD1Adapter } from './d1'
import { createTursoAdapter } from './turso'
import { createPlanetscaleAdapter } from './planetscale'

/**
 * Create a database adapter for the given engine
 */
export function createAdapter(db: any, engine: DatabaseEngine): DatabaseAdapter {
  switch (engine) {
    case 'better-sqlite3':
      return createSqliteAdapter(db)
    case 'postgres':
      return createPostgresAdapter(db)
    case 'mysql':
      return createMysqlAdapter(db)
    case 'd1':
      return createD1Adapter(db)
    case 'turso':
      return createTursoAdapter(db)
    case 'planetscale':
      return createPlanetscaleAdapter(db)
    default:
      throw new Error(`[nuxt-auto-api] Unsupported database engine: ${engine}`)
  }
}
