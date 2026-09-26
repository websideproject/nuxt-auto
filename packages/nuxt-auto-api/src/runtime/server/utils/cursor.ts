import { and, eq, gt, lt, or } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { createError } from 'h3'
import type { SortSpec } from './buildOrderBy'
import { primaryKeyName } from './table'

/**
 * Keyset (cursor) pagination.
 *
 * The page order is the requested sort plus the primary key as a final tiebreaker, so the order is total and
 * a page boundary is never ambiguous. The cursor carries the values of those columns from the last row;
 * the next page is every row strictly after it in that order:
 *
 *   (a > va) OR (a = va AND b > vb) OR (a = va AND b = vb AND id > vid)      (`<` for descending keys)
 *
 * Sort columns used with cursors must be NOT NULL — SQL comparisons against NULL are never true, so a row
 * whose sort value is NULL cannot be positioned after a cursor. A cursor that carries a NULL is a 400.
 */

/** The full ordering for cursor pagination: the sort, then the primary key. */
export function cursorOrder(specs: SortSpec[], table: any): SortSpec[] {
  const pk = primaryKeyName(table)
  if (specs.some(s => s.field === pk)) return specs
  return [...specs, { field: pk, direction: specs[0]?.direction ?? 'asc' }]
}

export function encodeCursor(row: any, order: SortSpec[]): string {
  const values = order.map((s) => {
    const v = row?.[s.field]
    return v instanceof Date ? { $date: v.getTime() } : v
  })
  return Buffer.from(JSON.stringify(values)).toString('base64url')
}

function invalidCursor(): never {
  throw createError({ statusCode: 400, message: 'Invalid cursor' })
}

export function decodeCursor(cursor: string, order: SortSpec[]): any[] {
  let values: any
  try {
    values = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  }
  catch {
    invalidCursor()
  }
  if (!Array.isArray(values) || values.length !== order.length) invalidCursor()
  return values.map((v: any) => {
    if (v === null || v === undefined) {
      throw createError({ statusCode: 400, message: 'Cursor pagination needs NOT NULL sort columns' })
    }
    if (v && typeof v === 'object' && typeof v.$date === 'number') return new Date(v.$date)
    if (typeof v === 'object') invalidCursor()
    return v
  })
}

/** WHERE clause selecting the rows after `cursor` in `order`. */
export function buildCursorWhere(table: any, cursor: string, order: SortSpec[]): SQL {
  const values = decodeCursor(cursor, order)
  const branches: SQL[] = []
  order.forEach((spec, i) => {
    const parts: SQL[] = order.slice(0, i).map((prev, j) => eq(table[prev.field], values[j]))
    const column = table[spec.field]
    parts.push(spec.direction === 'desc' ? lt(column, values[i]) : gt(column, values[i]))
    branches.push(parts.length === 1 ? parts[0]! : and(...parts)!)
  })
  return branches.length === 1 ? branches[0]! : or(...branches)!
}
