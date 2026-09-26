import type { DatabaseEngine, DatabaseAdapter } from '../../../types/database'
import { createSqliteAdapter } from './sqlite'
import { createPostgresAdapter } from './postgres'
import { createMysqlAdapter } from './mysql'
import { createD1Adapter } from './d1'
import { createTursoAdapter } from './turso'
import { createPlanetscaleAdapter } from './planetscale'
import { reentrant } from './reentrant'

/**
 * Create a database adapter for the given engine
 */
export function createAdapter(db: any, engine: DatabaseEngine): DatabaseAdapter {
  switch (engine) {
    case 'better-sqlite3':
      return createSqliteAdapter(db)
    case 'postgres':
      return reentrant(createPostgresAdapter(db))
    case 'mysql':
      return reentrant(createMysqlAdapter(db))
    case 'd1':
      return createD1Adapter(db)
    case 'turso':
      return reentrant(createTursoAdapter(db))
    case 'planetscale':
      return reentrant(createPlanetscaleAdapter(db))
    default:
      throw new Error(`[nuxt-auto-api] Unsupported database engine: ${engine}`)
  }
}
