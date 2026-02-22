import type { DatabaseAdapter } from '../../../types/database'

export function createPostgresAdapter(db: any): DatabaseAdapter {
  return {
    engine: 'postgres',
    db,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      return db.transaction(async (tx: any) => fn({ tx }))
    },
    getMutationCount(result: any): number {
      // Postgres returns array of affected rows
      if (Array.isArray(result)) return result.length
      return result?.rowCount ?? result?.count ?? 0
    },
    supportsReturning: true,
    supportsNativeBatch: false,
  }
}
