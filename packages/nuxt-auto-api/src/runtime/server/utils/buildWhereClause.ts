import type { SQL } from 'drizzle-orm'
import { and, eq, ne, gt, gte, lt, lte, like, inArray, notInArray, isNull, isNotNull } from 'drizzle-orm'
import { createError } from 'h3'
import { getColumns } from './table'

/** Largest `$in` / `$nin` list accepted — bounds the size of the generated SQL. */
export const MAX_IN_VALUES = 500

const OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$like', '$in', '$nin', '$null'])

function badFilter(message: string): never {
  throw createError({ statusCode: 400, message })
}

function toList(value: any, field: string, op: string): any[] {
  const values = Array.isArray(value) ? value : String(value).split(',')
  if (values.length === 0) badFilter(`Filter '${field}.${op}' needs at least one value`)
  if (values.length > MAX_IN_VALUES) badFilter(`Filter '${field}.${op}' accepts at most ${MAX_IN_VALUES} values`)
  return values
}

/**
 * Build a WHERE clause from a filter object.
 *
 *   { status: 'open' }                       equality (`null` → IS NULL, an array → IN)
 *   { views: { $gt: 10, $lte: 100 } }        operators, ANDed
 *
 * Operators: `$eq $ne $gt $gte $lt $lte $like` (contains) `$in $nin` (array or comma list) `$null` (true/false).
 *
 * Strict by design: a field that is not a column, a field outside `allowed` (hidden / unreadable), or an
 * unknown operator is a **400** — never silently dropped, because a dropped condition widens the result.
 *
 * @param filter  the parsed filter object
 * @param table   a Drizzle table, or the aliased field map Drizzle passes to a relational `where` callback
 * @param allowed the fields this caller may filter on (defaults to every column of `table`)
 */
export function buildWhereClause(
  filter: Record<string, any> | undefined | null,
  table: any,
  allowed?: Set<string>,
): SQL | undefined {
  if (filter === undefined || filter === null || (filter as unknown) === '') return undefined
  if (typeof filter !== 'object' || Array.isArray(filter)) badFilter('Filter must be a JSON object')

  const columns = allowed ?? new Set(Object.keys(getColumns(table)))
  const conditions: SQL[] = []

  for (const [field, value] of Object.entries(filter)) {
    if (!columns.has(field) || !table[field]) badFilter(`Unknown field '${field}' in filter`)
    const column = table[field]

    if (value === null) {
      conditions.push(isNull(column))
      continue
    }
    if (Array.isArray(value)) {
      conditions.push(inArray(column, toList(value, field, '$in')))
      continue
    }
    if (typeof value !== 'object' || value instanceof Date) {
      conditions.push(eq(column, value))
      continue
    }

    const operators = Object.entries(value)
    if (operators.length === 0) badFilter(`Filter '${field}' has no operator`)
    for (const [operator, operand] of operators) {
      if (!OPERATORS.has(operator)) badFilter(`Unknown filter operator '${operator}' on '${field}'`)
      switch (operator) {
        case '$eq':
          conditions.push(operand === null ? isNull(column) : eq(column, operand))
          break
        case '$ne':
          conditions.push(operand === null ? isNotNull(column) : ne(column, operand))
          break
        case '$gt':
          conditions.push(gt(column, operand))
          break
        case '$gte':
          conditions.push(gte(column, operand))
          break
        case '$lt':
          conditions.push(lt(column, operand))
          break
        case '$lte':
          conditions.push(lte(column, operand))
          break
        case '$like':
          conditions.push(like(column, `%${operand}%`))
          break
        case '$in':
          conditions.push(inArray(column, toList(operand, field, '$in')))
          break
        case '$nin':
          conditions.push(notInArray(column, toList(operand, field, '$nin')))
          break
        case '$null':
          conditions.push(operand === true || operand === 'true' ? isNull(column) : isNotNull(column))
          break
      }
    }
  }

  if (conditions.length === 0) return undefined
  return conditions.length === 1 ? conditions[0] : and(...conditions)
}

/** Parse `?filter=` (a JSON string from the URL, or an object from `$fetch`) — 400 on malformed JSON. */
export function parseFilterParam(filter: unknown): Record<string, any> | undefined {
  if (filter === undefined || filter === null || filter === '') return undefined
  if (typeof filter === 'string') {
    try {
      return JSON.parse(filter)
    }
    catch {
      badFilter('Filter is not valid JSON')
    }
  }
  return filter as Record<string, any>
}
