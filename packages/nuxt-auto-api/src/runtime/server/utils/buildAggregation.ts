import { useRuntimeConfig } from 'nitropack/runtime'
import { count, sum, avg, min, max, sql, and } from 'drizzle-orm'
import { createError } from 'h3'
import type { AggregationQuery, AggregationFunction, HandlerContext } from '../../types'

const FUNCTIONS: AggregationFunction[] = ['count', 'sum', 'avg', 'min', 'max']

function bad(message: string): never {
  throw createError({ statusCode: 400, message })
}

/**
 * Parse `?aggregate=` — `count`, `sum(amount)`, `avg(price),count`, … Results are keyed `count` and
 * `<fn>_<field>` (e.g. `sum_amount`). Anything else is a 400.
 */
export function parseAggregateParam(aggregateParam: string): AggregationQuery['aggregates'] {
  const aggregates: AggregationQuery['aggregates'] = []
  for (const part of aggregateParam.split(',').map(p => p.trim()).filter(Boolean)) {
    const match = /^(\w+)(?:\(\s*([\w$]+|\*)\s*\))?$/.exec(part)
    if (!match) bad(`Invalid aggregate '${part}'`)
    const fn = match[1]!.toLowerCase() as AggregationFunction
    const field = match[2]
    if (!FUNCTIONS.includes(fn)) bad(`Unknown aggregate function '${match[1]}'`)
    if (fn === 'count') {
      aggregates.push({ function: 'count', field: field && field !== '*' ? field : '*', alias: field && field !== '*' ? `count_${field}` : 'count' })
    }
    else {
      if (!field || field === '*') bad(`Aggregate function '${fn}' needs a field`)
      aggregates.push({ function: fn, field, alias: `${fn}_${field}` })
    }
  }
  if (aggregates.length === 0) bad('At least one aggregate function is required')
  return aggregates
}

/** Drizzle selection for the aggregates (fields must already be validated as readable columns). */
export function buildAggregateSelection(aggregates: AggregationQuery['aggregates'], table: any): Record<string, any> {
  const selection: Record<string, any> = {}
  for (const { function: fn, field, alias } of aggregates) {
    const column = field && field !== '*' ? table[field] : undefined
    if (field && field !== '*' && !column) bad(`Unknown field '${field}' in aggregate`)
    const key = alias || fn
    switch (fn) {
      case 'count':
        selection[key] = column ? count(column) : count()
        break
      case 'sum':
        selection[key] = sum(column)
        break
      case 'avg':
        selection[key] = avg(column)
        break
      case 'min':
        selection[key] = min(column)
        break
      case 'max':
        selection[key] = max(column)
        break
    }
  }
  return selection
}

const HAVING_OPS: Record<string, string> = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=', $eq: '=', $ne: '<>' }

/**
 * `?having={"count":{"$gt":5}}` — conditions on the aggregate results (by alias).
 */
export function buildHavingClause(having: Record<string, any> | undefined, selection: Record<string, any>): any | undefined {
  if (!having) return undefined
  if (typeof having !== 'object' || Array.isArray(having)) bad('having must be a JSON object')
  const conditions: any[] = []
  for (const [alias, condition] of Object.entries(having)) {
    const expr = selection[alias]
    if (!expr) bad(`Unknown aggregate '${alias}' in having`)
    const entries = condition !== null && typeof condition === 'object' ? Object.entries(condition) : [['$eq', condition]]
    for (const [op, value] of entries) {
      const symbol = HAVING_OPS[op as string]
      if (!symbol) bad(`Unknown having operator '${op}'`)
      if (typeof value !== 'number' && typeof value !== 'string') bad(`having '${alias}.${op}' needs a number or string`)
      conditions.push(sql`${expr} ${sql.raw(symbol)} ${value}`)
    }
  }
  return conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)
}

/** One-row aggregation over `where` (used by `GET /api/{resource}?aggregate=`). */
export async function executeSimpleAggregation(db: any, table: any, aggregates: AggregationQuery['aggregates'], where?: any): Promise<Record<string, any>> {
  let query = db.select(buildAggregateSelection(aggregates, table)).from(table)
  if (where) query = query.where(where)
  const [row] = await query
  return row || {}
}

/**
 * Grouped aggregation. Group columns are returned under their property names.
 */
export async function executeComplexAggregation(
  db: any,
  table: any,
  q: Pick<AggregationQuery, 'aggregates' | 'groupBy' | 'having'>,
  where?: any,
): Promise<any[]> {
  const selection = buildAggregateSelection(q.aggregates, table)
  const groupColumns = (q.groupBy ?? []).map((f) => {
    if (!table[f]) bad(`Unknown field '${f}' in groupBy`)
    if (f in selection) bad(`groupBy field '${f}' collides with an aggregate name`)
    selection[f] = table[f]
    return table[f]
  })

  let query = db.select(selection).from(table)
  if (where) query = query.where(where)
  if (groupColumns.length) query = query.groupBy(...groupColumns)
  const having = buildHavingClause(q.having, selection)
  if (having) query = query.having(having)
  return await query
}

/** Config limits for aggregations (`autoApi.aggregations`). */
export function validateAggregation(
  aggregates: AggregationQuery['aggregates'],
  groupBy?: string[],
  context?: HandlerContext,
): { valid: boolean, error?: string } {
  const config = ((context?.runtimeConfig as any) ?? useRuntimeConfig?.())?.autoApi?.aggregations
  if (config?.enabled === false) return { valid: false, error: 'Aggregations are disabled' }
  if (groupBy?.length && config?.allowGroupBy === false) return { valid: false, error: 'Group by is disabled' }
  const maxFields = config?.maxGroupByFields ?? 5
  if ((groupBy?.length ?? 0) > maxFields) return { valid: false, error: `Group by is limited to ${maxFields} fields` }
  if (!aggregates.length) return { valid: false, error: 'At least one aggregate function is required' }
  return { valid: true }
}
