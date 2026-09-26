import { getTableColumns } from 'drizzle-orm'
import { createError } from 'h3'

/** Column map of a Drizzle table, keyed by the TypeScript property name. */
export function getColumns(table: any): Record<string, any> {
  if (!table) return {}
  try {
    return getTableColumns(table)
  }
  catch {
    return {}
  }
}

export function hasColumn(table: any, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(getColumns(table), key)
}

/** Property key of the table's single-column primary key (falls back to `id`). */
export function primaryKeyName(table: any): string {
  const columns = getColumns(table)
  for (const [key, column] of Object.entries(columns)) {
    if ((column as any)?.primary) return key
  }
  return 'id'
}

export function primaryKeyColumn(table: any): any {
  return getColumns(table)[primaryKeyName(table)]
}

/**
 * Whether the database generates the primary key: auto-increment (MySQL, SQLite `autoIncrement`), serial and
 * identity (Postgres), or SQLite's integer rowid key.
 */
export function isGeneratedPrimaryKey(table: any): boolean {
  const column = primaryKeyColumn(table)
  if (!column) return false
  return column.autoIncrement === true
    || /Serial/.test(String(column.columnType))
    || !!column.generatedIdentity
    || (column.columnType === 'SQLiteInteger' && column.primary === true)
}

/**
 * Coerce a route id to the primary key's type. A non-numeric id for a numeric key can never match a row,
 * so it is a 404 rather than a database error.
 */
export function coerceId(table: any, id: string | number, resource = 'Record'): string | number {
  const column = primaryKeyColumn(table)
  if (column?.dataType === 'number' || column?.dataType === 'bigint') {
    const n = typeof id === 'number' ? id : /^-?\d+$/.test(String(id)) ? Number(id) : Number.NaN
    if (!Number.isSafeInteger(n)) throw createError({ statusCode: 404, message: `${resource} with id ${id} not found` })
    return n
  }
  return String(id)
}
