import type { DatabaseAdapter } from '../../../types/database'

export function createTursoAdapter(db: any): DatabaseAdapter {
  return {
    engine: 'turso',
    db,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      // Turso supports db.batch(stmts, 'write') for atomic operations
      // Also supports traditional transactions via db.transaction()
      if (typeof db.transaction === 'function') {
        return db.transaction(async (tx: any) => fn({ tx }))
      }
      // Fallback: run against db directly
      return fn({ tx: db })
    },
    getMutationCount(result: any): number {
      // Turso returns { rowsAffected: N }
      if (result?.rowsAffected !== undefined) return result.rowsAffected
      // SQLite-compatible format
      if (result?.changes !== undefined) return result.changes
      if (Array.isArray(result)) return result.length
      return 0
    },
    supportsReturning: true,
    supportsNativeBatch: true,
  }
}
