import type { DatabaseAdapter } from '../../../types/database'

export function createSqliteAdapter(db: any): DatabaseAdapter {
  return {
    engine: 'better-sqlite3',
    db,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      // better-sqlite3 transactions are synchronous but drizzle wraps them
      return db.transaction((tx: any) => fn({ tx }))
    },
    getMutationCount(result: any): number {
      // SQLite returns { changes: N }
      return result?.changes ?? 0
    },
    supportsReturning: true,
    supportsNativeBatch: false,
  }
}
