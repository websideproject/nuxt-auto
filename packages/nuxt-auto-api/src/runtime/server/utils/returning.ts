import { eq, inArray, is } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { MySqlTable } from 'drizzle-orm/mysql-core'
import { primaryKeyColumn, primaryKeyName } from './table'

/**
 * Write-then-return helpers that work on every dialect.
 *
 * SQLite, Postgres and D1 support `RETURNING`. MySQL (and PlanetScale) do not — Drizzle's MySQL builders
 * have no `.returning()` — so there the row is read back by primary key after the write.
 */

export function supportsReturning(table: any): boolean {
  return !is(table, MySqlTable)
}

/** Insert one or more rows and return them as stored. */
export async function insertReturning(db: any, table: any, values: Record<string, any> | Record<string, any>[]): Promise<any[]> {
  const list = Array.isArray(values) ? values : [values]
  if (list.length === 0) return []
  if (supportsReturning(table)) return await db.insert(table).values(list).returning()

  const pkName = primaryKeyName(table)
  const inserted: Array<Record<string, any>> = await db.insert(table).values(list).$returningId()
  const ids = inserted.map((r, i) => r?.[pkName] ?? list[i]?.[pkName]).filter(v => v !== undefined)
  if (ids.length === 0) return []
  return await db.select().from(table).where(inArray(primaryKeyColumn(table), ids))
}

/** Update the row with primary key `id` and return it as stored (`undefined` when no row matched). */
export async function updateReturning(db: any, table: any, id: string | number, set: Record<string, any>): Promise<any | undefined> {
  const where: SQL = eq(primaryKeyColumn(table), id)
  if (supportsReturning(table)) {
    const [row] = await db.update(table).set(set).where(where).returning()
    return row
  }
  await db.update(table).set(set).where(where)
  const pkName = primaryKeyName(table)
  const readBack: SQL = set[pkName] !== undefined ? eq(primaryKeyColumn(table), set[pkName]) : where
  const [row] = await db.select().from(table).where(readBack).limit(1)
  return row
}
