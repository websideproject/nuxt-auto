import type { SQL } from 'drizzle-orm'
import { and, or, eq, ne, gt, gte, lt, lte, like, inArray, notInArray, isNull, isNotNull } from 'drizzle-orm'
import { createError } from 'h3'
import { getColumns } from './table'
import { getDatabaseAdapter } from '../database'

/** Largest `$in` / `$nin` list accepted — bounds the size of the generated SQL. */
export const MAX_IN_VALUES = 500
/** On D1, which binds at most 100 parameters per statement (the rest of the query needs some too). */
export const MAX_IN_VALUES_D1 = 50

function maxInValues(): number {
  try {
    return getDatabaseAdapter().engine === 'd1' ? MAX_IN_VALUES_D1 : MAX_IN_VALUES
  }
  catch {
    return MAX_IN_VALUES
  }
}

/** Most branches in one `$or`. */
export const MAX_OR_BRANCHES = 20

const OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$like', '$in', '$nin', '$null'])

function badFilter(message: string): never {
  throw createError({ statusCode: 400, message })
}

function toList(value: any, field: string, op: string): any[] {
  const values = Array.isArray(value) ? value : String(value).split(',')
  if (values.length === 0) badFilter(`Filter '${field}.${op}' needs at least one value`)
  const max = maxInValues()
  if (values.length > max) badFilter(`Filter '${field}.${op}' accepts at most ${max} values`)
  return values
}

/**
 * A timestamp column (`dataType: 'date'`) binds through `Date#getTime` / `toISOString`, so the JSON string or
 * number a filter carries crashed the query (500). Coerce it here; an unparseable value is a 400.
 */
function operandFor(column: any, value: any, field: string): any {
  if (column?.dataType !== 'date' || value === null || value instanceof Date) return value
  if (typeof value !== 'string' && typeof value !== 'number') badFilter(`Filter '${field}' needs a date`)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) badFilter(`Filter '${field}' needs a date`)
  return date
}

/**
 * Build a WHERE clause from a filter object.
 *
 *   { status: 'open' }                       equality (`null` → IS NULL, an array → IN)
 *   { views: { $gt: 10, $lte: 100 } }        operators, ANDed
 *   { $or: [{ title: { $like: 'x' } }, …] }  any of several filters (top level only, at most 20)
 *
 * Operators: `$eq $ne $gt $gte $lt $lte $like` (contains) `$in $nin` (array or comma list) `$null` (true/false).
 * On a timestamp column the operands are dates: an ISO string or epoch milliseconds.
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
  return conditionsOf(filter, table, allowed ?? new Set(Object.keys(getColumns(table))), true)
}

function conditionsOf(filter: Record<string, any>, table: any, columns: Set<string>, topLevel: boolean): SQL | undefined {
  const conditions: SQL[] = []

  for (const [field, value] of Object.entries(filter)) {
    if (field === '$or') {
      // Each branch is a filter of its own, checked against the same readable columns.
      if (!topLevel) badFilter('\'$or\' cannot be nested')
      if (!Array.isArray(value) || value.length === 0) badFilter('\'$or\' needs a non-empty array of filters')
      if (value.length > MAX_OR_BRANCHES) badFilter(`'$or' accepts at most ${MAX_OR_BRANCHES} filters`)
      const branches = value.map((branch: any) => {
        if (!branch || typeof branch !== 'object' || Array.isArray(branch)) badFilter('\'$or\' filters must be JSON objects')
        const where = conditionsOf(branch, table, columns, false)
        if (!where) badFilter('\'$or\' filters cannot be empty')
        return where
      })
      conditions.push(branches.length === 1 ? branches[0]! : or(...branches)!)
      continue
    }
    if (!columns.has(field) || !table[field]) badFilter(`Unknown field '${field}' in filter`)
    const column = table[field]
    const coerce = (v: any) => operandFor(column, v, field)

    if (value === null) {
      conditions.push(isNull(column))
      continue
    }
    if (Array.isArray(value)) {
      conditions.push(inArray(column, toList(value, field, '$in').map(coerce)))
      continue
    }
    if (typeof value !== 'object' || value instanceof Date) {
      conditions.push(eq(column, coerce(value)))
      continue
    }

    const operators = Object.entries(value)
    if (operators.length === 0) badFilter(`Filter '${field}' has no operator`)
    for (const [operator, operand] of operators) {
      if (!OPERATORS.has(operator)) badFilter(`Unknown filter operator '${operator}' on '${field}'`)
      switch (operator) {
        case '$eq':
          conditions.push(operand === null ? isNull(column) : eq(column, coerce(operand)))
          break
        case '$ne':
          conditions.push(operand === null ? isNotNull(column) : ne(column, coerce(operand)))
          break
        case '$gt':
          conditions.push(gt(column, coerce(operand)))
          break
        case '$gte':
          conditions.push(gte(column, coerce(operand)))
          break
        case '$lt':
          conditions.push(lt(column, coerce(operand)))
          break
        case '$lte':
          conditions.push(lte(column, coerce(operand)))
          break
        case '$like':
          // A timestamp column cannot bind a pattern string (500); substring search on a date has no meaning.
          if (column.dataType === 'date') badFilter(`Filter '${field}.$like' needs a text column`)
          conditions.push(like(column, `%${operand}%`))
          break
        case '$in':
          conditions.push(inArray(column, toList(operand, field, '$in').map(coerce)))
          break
        case '$nin':
          conditions.push(notInArray(column, toList(operand, field, '$nin').map(coerce)))
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
