/**
 * Supported database engines
 */
export type DatabaseEngine = 'better-sqlite3' | 'postgres' | 'mysql' | 'd1' | 'turso' | 'planetscale'

/**
 * Result returned from atomic operations
 */
export interface AtomicContext {
  /** Transaction instance (or db if native batch) */
  tx: any
}

/**
 * Database adapter interface - abstracts engine-specific behavior
 */
export interface DatabaseAdapter {
  /** Database engine identifier */
  engine: DatabaseEngine
  /** Drizzle database instance */
  db: any
  /**
   * Execute operations atomically.
   * Uses db.transaction() for traditional DBs, db.batch() for D1/Turso.
   */
  atomic: <T>(fn: (ctx: AtomicContext) => T | Promise<T>) => Promise<T>
  /**
   * Get the number of affected rows from a mutation result.
   * Normalizes engine-specific result formats.
   */
  getMutationCount: (result: any) => number
  /** Whether the engine supports RETURNING clause */
  supportsReturning: boolean
  /** Whether the engine supports native batch operations (D1, Turso) */
  supportsNativeBatch: boolean
}
