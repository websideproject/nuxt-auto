import type { DatabaseAdapter } from '../../../types/database'

export function createMysqlAdapter(db: any): DatabaseAdapter {
  return {
    engine: 'mysql',
    db,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      return db.transaction(async (tx: any) => fn({ tx }))
    },
    getMutationCount(result: any): number {
      // MySQL returns [ResultSetHeader] with affectedRows
      if (Array.isArray(result) && result[0]?.affectedRows !== undefined) {
        return result[0].affectedRows
      }
      return result?.affectedRows ?? 0
    },
    supportsReturning: false,
    supportsNativeBatch: false,
  }
}
