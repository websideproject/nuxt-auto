import type { DatabaseAdapter } from '../../../types/database'

export function createD1Adapter(db: any): DatabaseAdapter {
  return {
    engine: 'd1',
    db,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      // D1 supports db.batch() for atomic operations
      // For complex logic that needs a tx reference, fall back to running against db directly
      // since D1 doesn't have traditional transactions
      return fn({ tx: db })
    },
    getMutationCount(result: any): number {
      // D1 batch results are arrays of D1Result
      if (result?.meta?.changes !== undefined) return result.meta.changes
      if (Array.isArray(result)) return result.length
      return 0
    },
    supportsReturning: true,
    supportsNativeBatch: true,
  }
}
