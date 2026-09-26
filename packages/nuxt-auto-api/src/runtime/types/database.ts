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
   * Run `fn` in a transaction (`db.transaction()`); an `atomic()` inside another joins it. On D1, which has no
   * interactive transactions, `fn` runs directly — see `supportsTransactions`, and use `atomicWrites()` for
   * writes that must land together there.
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
  /**
   * Whether `atomic()` is a real transaction (rolled back on error). `false` on D1, which has no
   * interactive transactions: `atomic()` then runs the function directly and earlier writes stay —
   * `atomicWrites()` (one `db.batch()`) is the all-or-nothing path there.
   */
  supportsTransactions: boolean
}
