import { and } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, AggregationResponse } from '../../types'
import { parseAggregateParam, executeComplexAggregation, validateAggregation } from '../utils/buildAggregation'
import { buildWhereClause, parseFilterParam } from '../utils/buildWhereClause'
import { assertQueryField, readableColumns } from '../utils/queryFields'
import { rowScope } from '../utils/rowAccess'
import { serializeResponse } from '../utils/serializeResponse'
import { softDeleteModeFor } from './list'

/**
 * Aggregate handler - GET /api/[resource]/aggregate?aggregate=count,sum(total)&groupBy=status&filter=...
 *
 * Aggregates run over exactly the rows the caller could list (tenant, listFilter, soft delete). Aggregated,
 * grouped and filtered fields must be readable — `min(password)` or `groupBy=password` would otherwise
 * return a hidden column's values.
 */
export async function aggregateHandler(context: HandlerContext): Promise<AggregationResponse> {
  const { db, schema, resource } = context
  const q = context.validated.query || context.query
  const table = schema[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
  if (!q.aggregate) throw createError({ statusCode: 400, message: 'aggregate parameter is required' })

  const readable = await readableColumns(context, resource, table)
  const aggregates = parseAggregateParam(String(q.aggregate))
  const groupBy = q.groupBy
    ? (Array.isArray(q.groupBy) ? q.groupBy : String(q.groupBy).split(',')).map((f: string) => f.trim()).filter(Boolean)
    : undefined

  const check = validateAggregation(aggregates, groupBy, context)
  if (!check.valid) throw createError({ statusCode: 400, message: check.error || 'Invalid aggregation' })
  for (const a of aggregates) if (a.field && a.field !== '*') assertQueryField(a.field, readable, 'aggregate')
  for (const f of groupBy ?? []) assertQueryField(f, readable, 'groupBy')

  const conditions: any[] = []
  const filterWhere = buildWhereClause(parseFilterParam(q.filter), table, readable)
  if (filterWhere) conditions.push(filterWhere)
  const scope = rowScope(context, resource, table, { softDeleted: await softDeleteModeFor(context, q) })
  if (scope) conditions.push(scope)
  const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)

  let having: Record<string, any> | undefined
  if (q.having) {
    having = parseFilterParam(q.having)
  }

  const rows = await executeComplexAggregation(db, table, { aggregates, groupBy, having }, where)

  const groupKeys = new Set<string>(groupBy ?? [])
  const data = rows.map((row: any) => {
    const group: Record<string, any> = {}
    const values: Record<string, any> = {}
    for (const [key, value] of Object.entries(row)) {
      if (groupKeys.has(key)) group[key] = value
      else values[key] = value
    }
    return { ...(Object.keys(group).length ? { group } : {}), ...values }
  })

  return { data: serializeResponse(data), meta: { total: data.length } }
}
