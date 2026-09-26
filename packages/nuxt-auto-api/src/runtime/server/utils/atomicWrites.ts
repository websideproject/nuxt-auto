import type { DatabaseAdapter } from '../../types/database'
import { getDatabaseAdapter } from '../database'

/** A write, built from the database handle it runs on (inside a transaction that is the transaction). */
export type Write = (db: any) => any

/**
 * Run several writes all-or-nothing, on every engine — D1 included.
 *
 * `adapter.atomic(fn)` wraps an arbitrary async function in a transaction, which D1 cannot do: it has no
 * interactive transactions. What D1 does have is `db.batch([...])`, a list of statements it executes as one
 * transaction. So the multi-row writes of the API (bulk, cascading soft delete, batch restore, M2M) do their
 * reads and checks first, then hand the statements here:
 *
 *  - a database with transactions → the statements run in order inside `adapter.atomic()`
 *  - D1 (and libsql without `transaction()`) → one `db.batch()`
 *
 * Each write returns an unexecuted Drizzle query (a batch needs the statement, not its promise); on an engine
 * with transactions it may also return a promise, which is how MySQL's insert-then-select `RETURNING` stand-in
 * fits. Because nothing runs until every statement is built, no statement can depend on an earlier one's
 * result. Returns each statement's result, in order. A failing statement's index is on `error.writeIndex`
 * when the engine reports it (not from a D1 batch).
 */
export async function atomicWrites(writes: Write[], adapter: DatabaseAdapter = getDatabaseAdapter()): Promise<any[]> {
  if (writes.length === 0) return []
  if (adapter.supportsTransactions) {
    return adapter.atomic(async ({ tx }) => {
      const results: any[] = []
      for (const [i, write] of writes.entries()) {
        try {
          results.push(await write(tx))
        }
        catch (error: any) {
          if (error && typeof error === 'object') error.writeIndex = i
          throw error
        }
      }
      return results
    })
  }
  if (adapter.supportsNativeBatch && typeof adapter.db?.batch === 'function') {
    return adapter.db.batch(writes.map(write => write(adapter.db)))
  }
  const results: any[] = []
  for (const write of writes) results.push(await write(adapter.db))
  return results
}

/**
 * `atomicWrites` for a request context: its adapter, or the initialized one when it wraps the same database.
 * A context built by hand around a bare Drizzle db (a test, a script) has neither — the writes then run one
 * after another on `context.db`, which is all such a caller could have done before.
 */
export async function atomicWritesFor(context: { adapter?: DatabaseAdapter | null, db?: any }, writes: Write[]): Promise<any[]> {
  let adapter = context.adapter ?? undefined
  if (!adapter) {
    try {
      const initialized = getDatabaseAdapter()
      if (!context.db || initialized.db === context.db) adapter = initialized
    }
    catch {
      // not initialized
    }
  }
  if (adapter) return atomicWrites(writes, adapter)
  const results: any[] = []
  for (const write of writes) results.push(await write(context.db))
  return results
}

/**
 * D1 allows at most 100 bound parameters in one statement, so an `IN (…)` over a list whose size the caller
 * controls (linked ids, a page of rows, a cascade batch) is split into chunks of this many values. Other
 * engines allow tens of thousands; one chunk size everywhere keeps a single code path.
 */
export const MAX_IDS_PER_STATEMENT = 50

export function chunk<T>(list: T[], size = MAX_IDS_PER_STATEMENT): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Run `select` once per chunk of `ids` and concatenate the rows. */
export async function selectInChunks<T>(ids: T[], select: (ids: T[]) => Promise<any[]>): Promise<any[]> {
  const rows: any[] = []
  for (const part of chunk(ids)) rows.push(...await select(part))
  return rows
}
