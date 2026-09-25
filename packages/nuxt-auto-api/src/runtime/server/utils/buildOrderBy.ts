import { asc, desc } from 'drizzle-orm'
import { createError } from 'h3'
import { getColumns } from './table'

export interface SortSpec {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * Parse `?sort=` — `field`, `-field` (descending), a comma list (`status,-createdAt`) or an array.
 * A field outside `allowed` (unknown, hidden or unreadable) is a 400.
 */
export function parseSort(sort: string | string[] | undefined, table: any, allowed?: Set<string>): SortSpec[] {
  if (!sort) return []
  const parts = (Array.isArray(sort) ? sort : [sort])
    .flatMap(s => String(s).split(','))
    .map(s => s.trim())
    .filter(Boolean)

  const columns = allowed ?? new Set(Object.keys(getColumns(table)))
  const specs: SortSpec[] = []
  for (const part of parts) {
    const direction = part.startsWith('-') ? 'desc' : 'asc'
    const field = part.replace(/^[-+]/, '')
    if (!columns.has(field) || !table[field]) {
      throw createError({ statusCode: 400, message: `Unknown field '${field}' in sort` })
    }
    if (!specs.some(s => s.field === field)) specs.push({ field, direction })
  }
  return specs
}

export function toOrderBy(specs: SortSpec[], table: any): any[] {
  return specs.map(s => (s.direction === 'desc' ? desc(table[s.field]) : asc(table[s.field])))
}

export function buildOrderBy(sort: string | string[] | undefined, table: any, allowed?: Set<string>): any[] {
  return toOrderBy(parseSort(sort, table, allowed), table)
}
