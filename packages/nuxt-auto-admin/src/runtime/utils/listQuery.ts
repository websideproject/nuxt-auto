import type { ColumnMetadata, ResourceSchema } from '../types'

/** How a column is filtered: text → contains, enum → one value, boolean → yes/no, number/date → a range. */
export type FilterKind = 'text' | 'enum' | 'boolean' | 'number' | 'date'

/** A column's filter as the user typed it: a string, or a range of strings (`YYYY-MM-DD` for dates). */
export type FilterValue = string | { min?: string, max?: string }
export type FilterState = Record<string, FilterValue>

export interface FilterableColumn {
  name: string
  kind: FilterKind
  enumValues?: string[]
}

/**
 * The filter kind of a column, from the type the database compares — or `null` when the column is not
 * filtered (JSON, blobs, UUIDs: `LIKE` on a Postgres `uuid` is a database error, not a match).
 */
export function filterKind(column: ColumnMetadata): FilterKind | null {
  if (column.enumValues?.length) return 'enum'
  const type = column.type || ''
  switch (column.dataType) {
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'number':
    case 'bigint':
      return 'number'
    case 'string':
      if (/numeric|decimal/i.test(type)) return 'number'
      if (/text|char/i.test(type)) return 'text'
      return null
    default:
      return null
  }
}

/**
 * The columns the list may filter and search on: the ones it shows, minus hidden fields and fields the caller
 * may not read. The API refuses a filter on any other field with a 400.
 */
export function filterableColumns(
  resource: ResourceSchema,
  fieldPermissions?: Record<string, { canRead?: boolean }>,
): FilterableColumn[] {
  const out: FilterableColumn[] = []
  for (const name of resource.listFields) {
    const column = resource.columns.find(col => col.name === name)
    if (!column || resource.hiddenFields.includes(name) || fieldPermissions?.[name]?.canRead === false) continue
    const kind = filterKind(column)
    if (kind) out.push({ name, kind, ...(kind === 'enum' ? { enumValues: column.enumValues } : {}) })
  }
  return out
}

/** The API accepts at most 20 branches in one `$or`. */
const MAX_SEARCH_FIELDS = 20

/** The text columns a search term is matched against. */
export function searchFieldsOf(columns: FilterableColumn[]): string[] {
  return columns.filter(col => col.kind === 'text').map(col => col.name).slice(0, MAX_SEARCH_FIELDS)
}

function numberBound(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** A `YYYY-MM-DD` day as the ISO instant of its first (or last) millisecond in the browser's time zone. */
function dateBound(value: string | undefined, end: boolean): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function conditionFor(kind: FilterKind, value: FilterValue): Record<string, unknown> | undefined {
  if (kind === 'number' || kind === 'date') {
    if (typeof value !== 'object') return undefined
    const min = kind === 'number' ? numberBound(value.min) : dateBound(value.min, false)
    const max = kind === 'number' ? numberBound(value.max) : dateBound(value.max, true)
    if (min === undefined && max === undefined) return undefined
    return { ...(min !== undefined ? { $gte: min } : {}), ...(max !== undefined ? { $lte: max } : {}) }
  }
  if (typeof value !== 'string' || value === '') return undefined
  if (kind === 'text') return { $like: value }
  if (kind === 'boolean') return value === 'true' || value === 'false' ? { $eq: value === 'true' } : undefined
  return { $eq: value }
}

/**
 * The API `filter` for the list: every column filter ANDed, and the search term as an `$or` of `$like` over the
 * searchable columns. Filters on columns that are not in `columns` are left out — the UI does not show them.
 */
export function buildListFilter(options: {
  columns: FilterableColumn[]
  filters?: FilterState
  search?: string
  searchFields?: string[]
}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(options.filters ?? {})) {
    const column = options.columns.find(col => col.name === field)
    const condition = column && conditionFor(column.kind, value)
    if (condition) out[field] = condition
  }
  const term = options.search?.trim()
  if (term && options.searchFields?.length) {
    out.$or = options.searchFields.map(field => ({ [field]: { $like: term } }))
  }
  return Object.keys(out).length ? out : undefined
}

/** How many column filters are set. */
export function activeFilterCount(filters: FilterState): number {
  return Object.values(filters).filter(value => typeof value === 'string' ? value !== '' : !!(value.min || value.max)).length
}

/** The filter state from the `filters` query parameter (JSON); anything malformed is ignored. */
export function parseFilterState(raw: unknown): FilterState {
  if (typeof raw !== 'string' || !raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const out: FilterState = {}
  for (const [field, value] of Object.entries(parsed)) {
    if (typeof value === 'string') out[field] = value
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { min, max } = value as Record<string, unknown>
      out[field] = { ...(typeof min === 'string' ? { min } : {}), ...(typeof max === 'string' ? { max } : {}) }
    }
  }
  return out
}

/** The filter state as the `filters` query parameter, without empty entries (`undefined` when none are set). */
export function serializeFilterState(filters: FilterState): string | undefined {
  const out: FilterState = {}
  for (const [field, value] of Object.entries(filters)) {
    if (typeof value === 'string') {
      if (value !== '') out[field] = value
    }
    else if (value.min || value.max) {
      out[field] = { ...(value.min ? { min: value.min } : {}), ...(value.max ? { max: value.max } : {}) }
    }
  }
  return Object.keys(out).length ? JSON.stringify(out) : undefined
}
