import type { DatabaseAdapter } from '../../../types/database'

export function createD1Adapter(db: unknown): DatabaseAdapter {
  return {
    engine: 'd1',
    db,
    async atomic<T>(fn: (ctx: { tx: unknown }) => T | Promise<T>): Promise<T> {
      // D1 has no interactive transactions, so an arbitrary async function cannot be made atomic: it runs
      // directly and earlier writes stay if it throws (`supportsTransactions: false` tells callers). What D1
      // does have is db.batch() — statements executed as one transaction — which is what `atomicWrites()`
      // uses; the API's own multi-row writes go through it.
      return fn({ tx: db })
    },
    getMutationCount(result: any): number {
      // D1 batch results are arrays of D1Result
      if (result?.meta?.changes !== undefined) return result.meta.changes
      if (Array.isArray(result)) return result.length
      return 0
    },
    supportsReturning: true,
    supportsTransactions: false,
    supportsNativeBatch: true,
  }
}
