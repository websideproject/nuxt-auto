import type { ColumnMetadata } from '../types'

export interface ImportField {
  name: string
  label: string
  /** The column's metadata, for typing the CSV text (a number column gets a number). */
  column?: ColumnMetadata
}

/** CSV column index → field name, or `null` to skip the column. */
export type ImportMapping = Array<string | null>

const normalize = (value: string) => value.toLowerCase().replace(/[\s_-]/g, '')

/** Map each CSV header to the field with the same name or label (ignoring case, spaces, `_` and `-`), once. */
export function autoMap(headers: string[], fields: ImportField[]): ImportMapping {
  const used = new Set<string>()
  return headers.map((header) => {
    const key = normalize(header)
    const field = fields.find(f => !used.has(f.name) && (normalize(f.name) === key || normalize(f.label) === key))
    if (!field) return null
    used.add(field.name)
    return field.name
  })
}

/**
 * One CSV cell as the value to send: numbers and booleans typed, JSON columns parsed; an empty cell is left
 * out (`undefined`) so the column's default applies. A value that does not parse is sent as text — the API's
 * validation then names the item and field.
 */
export function cellValue(raw: string, column?: ColumnMetadata): unknown {
  if (raw === '') return undefined
  switch (column?.dataType) {
    case 'number':
    case 'bigint': {
      const n = Number(raw)
      return raw.trim() !== '' && Number.isFinite(n) ? n : raw
    }
    case 'boolean': {
      const v = raw.trim().toLowerCase()
      if (['true', '1', 'yes'].includes(v)) return true
      if (['false', '0', 'no'].includes(v)) return false
      return raw
    }
    case 'json':
      try {
        return JSON.parse(raw)
      }
      catch {
        return raw
      }
    default:
      return raw
  }
}

/** The CSV data rows (header excluded) as request items, through `mapping`. */
export function mapRows(rows: string[][], mapping: ImportMapping, fields: ImportField[]): Record<string, unknown>[] {
  const byName = new Map(fields.map(f => [f.name, f]))
  return rows.map((row) => {
    const item: Record<string, unknown> = {}
    mapping.forEach((field, index) => {
      if (!field) return
      const value = cellValue(row[index] ?? '', byName.get(field)?.column)
      if (value !== undefined) item[field] = value
    })
    return item
  })
}

/** `items` in batches of at most `size`. */
export function toBatches<T>(items: T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step))
  return out
}
