import type { DatabaseEngine, DatabaseAdapter } from '../../types/database'
import { createAdapter } from './adapters/factory'

declare global {
  var __autoApiDbAdapter: DatabaseAdapter | undefined
}

/**
 * Initialize the database with an adapter.
 * Call this in your server plugin after creating the Drizzle DB instance.
 *
 * @example
 * ```ts
 * // server/plugins/database.ts
 * import { initializeDatabase } from 'nuxt-auto-api/database'
 *
 * export default defineNitroPlugin(() => {
 *   const db = drizzle(...)
 *   initializeDatabase(db, 'better-sqlite3')
 * })
 * ```
 */
export function initializeDatabase(db: any, engine: DatabaseEngine): DatabaseAdapter {
  const adapter = createAdapter(db, engine)
  globalThis.__autoApiDbAdapter = adapter
  // Backward compat: also set __autoApiDb
  ;(globalThis as any).__autoApiDb = db
  return adapter
}

/**
 * Get the database adapter.
 * Falls back to legacy globalThis.__autoApiDb with a default sqlite adapter if no adapter is set.
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (globalThis.__autoApiDbAdapter) {
    return globalThis.__autoApiDbAdapter
  }

  // Fallback to legacy setup
  const db = (globalThis as any).__autoApiDb
  if (db) {
    console.warn('[nuxt-auto-api] Using legacy globalThis.__autoApiDb. Consider using initializeDatabase() instead.')
    // Create a default sqlite adapter for backward compat
    const adapter = createAdapter(db, 'better-sqlite3')
    globalThis.__autoApiDbAdapter = adapter
    return adapter
  }

  throw new Error('[nuxt-auto-api] Database not initialized. Call initializeDatabase() in a server plugin.')
}

export { createAdapter } from './adapters/factory'
export * from './adapters/index'
