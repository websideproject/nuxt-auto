import type { HandlerContext } from '../../types'

/**
 * Inspect a Drizzle table object and return the JS field names whose columns
 * are JSON-typed. Covers:
 * - SQLite:     text(name, { mode: 'json' })  → config.mode === 'json'
 * - MySQL:      json(name)                    → columnType contains 'Json'
 * - PostgreSQL: json(name) / jsonb(name)      → columnType contains 'Json'
 * - drizzle dataType shorthand               → dataType === 'json'
 */
function getJsonFields(table: any): string[] {
  if (!table || typeof table !== 'object') return []
  const fields: string[] = []
  for (const [key, col] of Object.entries<any>(table)) {
    if (!col || typeof col !== 'object') continue
    const isJson
      = col.config?.mode === 'json'
      || col.dataType === 'json'
      || (typeof col.columnType === 'string' && col.columnType.toLowerCase().includes('json'))
    if (isJson) fields.push(key)
  }
  return fields
}

function parseRow(row: any, jsonFields: string[]): any {
  if (!row || typeof row !== 'object' || !jsonFields.length) return row
  const result = Object.assign({}, row)
  for (const field of jsonFields) {
    if (field in result && typeof result[field] === 'string') {
      try { result[field] = JSON.parse(result[field]) }
      catch {}
    }
  }
  return result
}

/**
 * Auto-parse JSON column values returned as strings by the DB driver.
 * Safe to call even if drizzle already parsed the value — the string check
 * ensures already-parsed values (arrays/objects) are left untouched.
 *
 * Should be applied to raw DB results BEFORE after-hooks run so that
 * hooks see proper typed values.
 */
export function parseJsonColumns(data: any, context: HandlerContext): any {
  const table = context.schema?.[context.resource]
  const jsonFields = getJsonFields(table)
  if (!jsonFields.length) return data

  if (Array.isArray(data)) {
    return data.map(row => parseRow(row, jsonFields))
  }
  return parseRow(data, jsonFields)
}
