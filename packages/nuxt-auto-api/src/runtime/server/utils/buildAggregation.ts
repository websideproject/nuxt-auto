import { useRuntimeConfig } from 'nitropack/runtime'
import { count, sum, avg, min, max, sql, and, asc } from 'drizzle-orm'
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
      // Drizzle returns sum and avg as strings (to keep a decimal's precision); the API answers numbers, like count.
      // A sum past Number.MAX_SAFE_INTEGER loses precision. min and max keep the column's own type (dates, text).
      case 'sum':
        selection[key] = sum(column).mapWith(Number)
        break
      case 'avg':
        selection[key] = avg(column).mapWith(Number)
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

export const DATE_BUCKETS = ['hour', 'day', 'week', 'month', 'year'] as const
export type DateBucket = typeof DATE_BUCKETS[number]

/**
 * A `groupBy` entry: a column (`status`), or a date column cut into buckets (`createdAt:month`). A bucketed
 * group is returned as `<field>_<bucket>` (`createdAt_month`).
 */
export function parseGroupBy(entry: string): { field: string, bucket?: DateBucket, key: string } {
  const [field, bucket, ...rest] = entry.split(':')
  if (!bucket) return { field: field!, key: field! }
  if (rest.length || !(DATE_BUCKETS as readonly string[]).includes(bucket)) {
    bad(`Invalid groupBy '${entry}': use <field>:${DATE_BUCKETS.join('|')}`)
  }
  return { field: field!, bucket: bucket as DateBucket, key: `${field}_${bucket}` }
}

// Bucket labels: hour `2026-10-18T14`, day and week `2026-10-18` (a week is labelled by its Monday), month
// `2026-10`, year `2026`. The formats are literals from this table, never request input.
const SQLITE_FORMATS: Record<Exclude<DateBucket, 'week'>, string> = { hour: '%Y-%m-%dT%H', day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' }
const PG_FORMATS: Record<Exclude<DateBucket, 'week'>, string> = { hour: 'YYYY-MM-DD"T"HH24', day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' }
const MYSQL_FORMATS: Record<Exclude<DateBucket, 'week'>, string> = { hour: '%Y-%m-%dT%H', day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' }

/** SQL for a date column cut into `bucket`, as a sortable text label. 400 for a column that holds no dates. */
export function dateBucketExpression(column: any, bucket: DateBucket, field: string): any {
  const type = String(column?.columnType ?? '')
  if (type === 'SQLiteTimestamp' || type === 'SQLiteText') {
    // Timestamps are stored as epoch seconds (`timestamp`) or milliseconds (`timestamp_ms`); text as ISO strings.
    const value = type === 'SQLiteText'
      ? sql`${column}`
      : column.mode === 'timestamp_ms' ? sql`${column} / 1000, 'unixepoch'` : sql`${column}, 'unixepoch'`
    if (bucket === 'week') return sql`date(${value}, 'weekday 0', '-6 days')`
    return sql`strftime(${sql.raw(`'${SQLITE_FORMATS[bucket]}'`)}, ${value})`
  }
  if (/^Pg(?:Timestamp|Date)/.test(type)) {
    if (bucket === 'week') return sql`to_char(date_trunc('week', ${column}), 'YYYY-MM-DD')`
    return sql`to_char(${column}, ${sql.raw(`'${PG_FORMATS[bucket]}'`)})`
  }
  if (/^MySql(?:Timestamp|DateTime|Date)/.test(type)) {
    if (bucket === 'week') return sql`date_format(date_sub(${column}, interval weekday(${column}) day), '%Y-%m-%d')`
    return sql`date_format(${column}, ${sql.raw(`'${MYSQL_FORMATS[bucket]}'`)})`
  }
  bad(`groupBy '${field}:${bucket}' needs a date or timestamp column`)
}

/**
 * Grouped aggregation. Group columns are returned under their property names, date buckets as
 * `<field>_<bucket>`, in bucket order.
 */
export async function executeComplexAggregation(
  db: any,
  table: any,
  q: Pick<AggregationQuery, 'aggregates' | 'groupBy' | 'having'>,
  where?: any,
): Promise<any[]> {
  const selection = buildAggregateSelection(q.aggregates, table)
  const buckets: any[] = []
  const groupColumns = (q.groupBy ?? []).map((entry) => {
    const { field, bucket, key } = parseGroupBy(entry)
    if (!table[field]) bad(`Unknown field '${field}' in groupBy`)
    if (key in selection) bad(`groupBy field '${key}' collides with an aggregate name`)
    const expression = bucket ? dateBucketExpression(table[field], bucket, field) : table[field]
    if (bucket) buckets.push(expression)
    selection[key] = expression
    return expression
  })

  let query = db.select(selection).from(table)
  if (where) query = query.where(where)
  if (groupColumns.length) query = query.groupBy(...groupColumns)
  if (buckets.length) query = query.orderBy(...buckets.map(b => asc(b)))
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
