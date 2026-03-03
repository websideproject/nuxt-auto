import { asc, desc } from 'drizzle-orm'

/**
 * Build ORDER BY clause from sort parameter
 *
 * Supports:
 * - sort=field (ascending)
 * - sort=-field (descending)
 * - sort=field1,-field2 (multiple sorts)
 */
export function buildOrderBy(sort: string | string[] | undefined, table: any): any[] {
  if (!sort) {
    return []
  }

  const sortArray = Array.isArray(sort) ? sort : [sort]
  const orderBy: any[] = []

  for (const sortField of sortArray) {
    const isDescending = sortField.startsWith('-')
    const field = isDescending ? sortField.slice(1) : sortField

    // Skip if field doesn't exist in table
    if (!(field in table)) {
      continue
    }

    const column = table[field]
    orderBy.push(isDescending ? desc(column) : asc(column))
  }

  return orderBy
}
