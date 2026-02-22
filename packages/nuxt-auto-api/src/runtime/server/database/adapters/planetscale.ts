import type { DatabaseAdapter } from '../../../types/database'

export function createPlanetscaleAdapter(db: any): DatabaseAdapter {
  return {
    engine: 'planetscale',
    db,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      return db.transaction(async (tx: any) => fn({ tx }))
    },
    getMutationCount(result: any): number {
      // PlanetScale uses MySQL-compatible protocol
      if (Array.isArray(result) && result[0]?.affectedRows !== undefined) {
        return result[0].affectedRows
      }
      return result?.rowsAffected ?? result?.affectedRows ?? 0
    },
    supportsReturning: false,
    supportsNativeBatch: false,
  }
}
