import { sql } from 'drizzle-orm'
import type { DatabaseAdapter } from '../../../types/database'

/**
 * better-sqlite3 adapter.
 *
 * better-sqlite3's own `transaction()` only accepts a SYNCHRONOUS function ("Transaction function cannot
 * return a promise"), while every caller of `atomic()` is async. So the transaction is driven explicitly:
 * `BEGIN IMMEDIATE` … `COMMIT` / `ROLLBACK`, with
 *
 *  - a lock, so two requests never interleave their transactions on the one connection, and
 *  - AsyncLocalStorage, so an `atomic()` called inside another (e.g. an M2M write inside a batch) joins the
 *    outer transaction instead of waiting on the lock forever.
 */
export function createSqliteAdapter(db: any): DatabaseAdapter {
  let lock: Promise<unknown> = Promise.resolve()
  let als: { getStore(): unknown, run<R>(store: unknown, fn: () => R): R } | null | undefined

  async function storage() {
    if (als === undefined) {
      try {
        const { AsyncLocalStorage } = await import('node:async_hooks')
        als = new AsyncLocalStorage()
      }
      catch {
        als = null
      }
    }
    return als
  }

  return {
    engine: 'better-sqlite3',
    db,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      const store = await storage()
      if (store?.getStore()) return await fn({ tx: db })

      const run = async (): Promise<T> => {
        db.run(sql`BEGIN IMMEDIATE`)
        try {
          const result = store ? await store.run(true, () => fn({ tx: db })) : await fn({ tx: db })
          db.run(sql`COMMIT`)
          return result
        }
        catch (error) {
          try {
            db.run(sql`ROLLBACK`)
          }
          catch {
            // already rolled back by SQLite (e.g. a constraint failure inside the transaction)
          }
          throw error
        }
      }

      const result = lock.then(run, run)
      lock = result.then(() => undefined, () => undefined)
      return result
    },
    getMutationCount(result: any): number {
      return result?.changes ?? 0
    },
    supportsReturning: true,
    supportsTransactions: true,
    supportsNativeBatch: false,
  }
}
