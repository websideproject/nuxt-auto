import { createError } from 'h3'
import { getTableColumns } from 'drizzle-orm'

/**
 * The DB columns named by a unique-constraint violation, or `null` when `error` is not one. Drizzle wraps the
 * driver's error (`DrizzleQueryError.cause`), so the whole cause chain is searched.
 *
 *  - SQLite / D1 / libSQL: `UNIQUE constraint failed: articles.slug` (composite: `t.a, t.b`)
 *  - PostgreSQL: code `23505`, detail `Key (slug)=(hello) already exists.`
 *  - MySQL: `ER_DUP_ENTRY` (1062) — the message names the index, not its columns, so no columns
 */
export function uniqueViolationColumns(error: unknown): string[] | null {
  for (let e: any = error, depth = 0; e && depth < 5; e = e.cause, depth++) {
    const message = String(e.message ?? '')
    const sqlite = message.match(/UNIQUE constraint failed: ([\w.]+(?:, [\w.]+)*)/)
    if (sqlite) return sqlite[1]!.split(', ').map(c => c.split('.').pop()!)
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return []
    if (e.code === '23505') {
      const key = String(e.detail ?? '').match(/Key \(([^)]+)\)=/)
      return key ? key[1]!.split(',').map(c => c.trim().replace(/^"|"$/g, '')) : []
    }
    if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) return []
  }
  return null
}

/**
 * A unique-constraint violation as a 409 naming the fields (property keys, as the client sent them), instead of
 * the driver's error as a 500. Anything else is returned unchanged.
 */
export function conflictFromUniqueViolation(error: unknown, table: any): unknown {
  const columns = uniqueViolationColumns(error)
  if (!columns) return error

  const byDbName = new Map<string, string>()
  try {
    for (const [key, column] of Object.entries(getTableColumns(table))) byDbName.set((column as any).name, key)
  }
  catch {
    // not a drizzle table — keep the DB names
  }
  const fields = columns.map(c => byDbName.get(c) ?? c)

  return createError({
    statusCode: 409,
    message: fields.length
      ? `A record with this ${fields.join(' and ')} already exists`
      : 'A record with these values already exists',
    data: { errors: fields.map(field => ({ path: [field], message: 'Already exists' })) },
  })
}
