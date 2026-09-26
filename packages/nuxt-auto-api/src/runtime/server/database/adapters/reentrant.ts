import type { DatabaseAdapter } from '../../../types/database'

interface Storage { getStore(): unknown, run<R>(store: unknown, fn: () => R): R }

let storage: Storage | null | undefined

/** AsyncLocalStorage, loaded lazily so a runtime without `node:async_hooks` still loads the adapter. */
export async function asyncStorage(): Promise<Storage | null> {
  if (storage === undefined) {
    try {
      const { AsyncLocalStorage } = await import('node:async_hooks')
      storage = new AsyncLocalStorage()
    }
    catch {
      storage = null
    }
  }
  return storage
}

/**
 * Make `atomic()` re-entrant: called inside another `atomic()` (a hook or a custom endpoint inside a bulk
 * write, say), it joins the outer transaction. Without this, Postgres and MySQL open a second transaction on
 * another pooled connection — its writes commit even when the outer one rolls back — and libsql blocks on its
 * own write lock (`SQLITE_BUSY`).
 */
export function reentrant(adapter: DatabaseAdapter): DatabaseAdapter {
  const begin = adapter.atomic
  return {
    ...adapter,
    async atomic<T>(fn: (ctx: { tx: any }) => T | Promise<T>): Promise<T> {
      const als = await asyncStorage()
      const outer = als?.getStore()
      if (outer) return await fn({ tx: outer })
      return begin(({ tx }) => als ? als.run(tx, () => fn({ tx })) : fn({ tx }))
    },
  }
}
