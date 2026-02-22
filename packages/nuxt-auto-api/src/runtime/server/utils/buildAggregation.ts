import { count, sum, avg, min, max, sql } from 'drizzle-orm'
import type { AggregationQuery, AggregationFunction } from '../../types'
import { buildWhereClause } from './buildWhereClause'

/**
 * Parse aggregation query parameter
 *
 * Syntax examples:
 * - aggregate=count
 * - aggregate=sum(amount)
 * - aggregate=avg(price),count
 * - aggregate=sum(amount),avg(amount),min(amount),max(amount)
 */
export function parseAggregateParam(aggregateParam: string): AggregationQuery['aggregates'] {
  const parts = aggregateParam.split(',').map(p => p.trim())
  const aggregates: AggregationQuery['aggregates'] = []

  for (const part of parts) {
    // Match function(field) or just function
    const match = part.match(/^(\w+)(?:\(([^)]+)\))?$/)

    if (!match) {
      console.warn(`[autoApi] Invalid aggregate syntax: ${part}`)
      continue
    }

    const [, func, field] = match
    const funcName = func.toLowerCase() as AggregationFunction

    // Validate function name
    if (!['count', 'sum', 'avg', 'min', 'max'].includes(funcName)) {
      console.warn(`[autoApi] Unknown aggregation function: ${funcName}`)
      continue
    }

    // Count doesn't require a field
    if (funcName === 'count') {
      aggregates.push({
        function: 'count',
        field: field || '*',
        alias: 'count',
      })
    } else {
      if (!field) {
        console.warn(`[autoApi] Aggregation function ${funcName} requires a field`)
        continue
      }
      aggregates.push({
        function: funcName,
        field,
        alias: `${funcName}_${field}`,
      })
    }
  }

  return aggregates
}

/**
 * Build Drizzle aggregation selection object
 */
export function buildAggregateSelection(
  aggregates: AggregationQuery['aggregates'],
  table: any
): Record<string, any> {
  const selection: Record<string, any> = {}

  for (const agg of aggregates) {
    const { function: func, field, alias } = agg

    switch (func) {
      case 'count':
        selection[alias || 'count'] = count()
        break
      case 'sum':
        if (field && table[field]) {
          selection[alias || `sum_${field}`] = sum(table[field])
        }
        break
      case 'avg':
        if (field && table[field]) {
          selection[alias || `avg_${field}`] = avg(table[field])
        }
        break
      case 'min':
        if (field && table[field]) {
          selection[alias || `min_${field}`] = min(table[field])
        }
        break
      case 'max':
        if (field && table[field]) {
          selection[alias || `max_${field}`] = max(table[field])
        }
        break
    }
  }

  return selection
}

/**
 * Build groupBy array from field names
 */
export function buildGroupBy(
  groupByFields: string | string[] | undefined,
  table: any
): any[] | undefined {
  if (!groupByFields) {
    return undefined
  }

  const fields = Array.isArray(groupByFields)
    ? groupByFields
    : String(groupByFields).split(',').map(f => f.trim())

  const groupBy: any[] = []

  for (const field of fields) {
    if (table[field]) {
      groupBy.push(table[field])
    } else {
      console.warn(`[autoApi] Unknown field in groupBy: ${field}`)
    }
  }

  return groupBy.length > 0 ? groupBy : undefined
}

/**
 * Build having clause for group filtering
 *
 * Example: having={count:{$gt:5}}
 */
export function buildHavingClause(
  havingParam: Record<string, any> | undefined,
  aggregateSelection: Record<string, any>
): any | undefined {
  if (!havingParam) {
    return undefined
  }

  // For now, build a simple SQL having clause
  // This is simplified - in production you'd want more robust parsing
  const conditions: any[] = []

  for (const [field, condition] of Object.entries(havingParam)) {
    const aggColumn = aggregateSelection[field]
    if (!aggColumn) {
      console.warn(`[autoApi] Unknown aggregate in having: ${field}`)
      continue
    }

    // Handle operators: $gt, $gte, $lt, $lte, $eq, $ne
    if (typeof condition === 'object') {
      for (const [op, value] of Object.entries(condition)) {
        switch (op) {
          case '$gt':
            conditions.push(sql`${aggColumn} > ${value}`)
            break
          case '$gte':
            conditions.push(sql`${aggColumn} >= ${value}`)
            break
          case '$lt':
            conditions.push(sql`${aggColumn} < ${value}`)
            break
          case '$lte':
            conditions.push(sql`${aggColumn} <= ${value}`)
            break
          case '$eq':
            conditions.push(sql`${aggColumn} = ${value}`)
            break
          case '$ne':
            conditions.push(sql`${aggColumn} != ${value}`)
            break
        }
      }
    } else {
      // Direct equality
      conditions.push(sql`${aggColumn} = ${condition}`)
    }
  }

  if (conditions.length === 0) {
    return undefined
  }

  // Combine conditions with AND
  return conditions.reduce((acc, curr) => {
    return acc ? sql`${acc} AND ${curr}` : curr
  })
}

/**
 * Execute simple aggregation (without groupBy) on a list query
 * Returns aggregate results to be added to response metadata
 */
export async function executeSimpleAggregation(
  db: any,
  table: any,
  aggregates: AggregationQuery['aggregates'],
  whereClause?: any
): Promise<Record<string, any>> {
  const selection = buildAggregateSelection(aggregates, table)

  let query = db.select(selection).from(table)

  if (whereClause) {
    query = query.where(whereClause)
  }

  const [result] = await query

  return result || {}
}

/**
 * Execute complex aggregation with groupBy and having
 * Returns array of grouped results
 */
export async function executeComplexAggregation(
  db: any,
  table: any,
  aggregationQuery: AggregationQuery
): Promise<any[]> {
  const { aggregates, groupBy: groupByFields, having, filter } = aggregationQuery

  // Build selection (aggregates + group by fields)
  const selection = buildAggregateSelection(aggregates, table)

  // Add group by fields to selection
  const groupBy = buildGroupBy(groupByFields, table)
  if (groupBy) {
    for (const field of groupBy) {
      // Get field name from the column object
      const fieldName = field.name || field.columnName || 'field'
      selection[fieldName] = field
    }
  }

  // Build query
  let query = db.select(selection).from(table)

  // Add where clause from filter
  if (filter) {
    const whereClause = buildWhereClause(filter, table)
    if (whereClause) {
      query = query.where(whereClause)
    }
  }

  // Add group by
  if (groupBy && groupBy.length > 0) {
    query = query.groupBy(...groupBy)
  }

  // Add having clause
  if (having) {
    const havingClause = buildHavingClause(having, selection)
    if (havingClause) {
      query = query.having(havingClause)
    }
  }

  return await query
}

/**
 * Validate aggregation configuration
 */
export function validateAggregation(
  aggregates: AggregationQuery['aggregates'],
  groupByFields?: string | string[]
): { valid: boolean; error?: string } {
  const runtimeConfig = useRuntimeConfig?.()
  const config = runtimeConfig?.autoApi?.aggregations

  // Check if aggregations are enabled
  if (config?.enabled === false) {
    return {
      valid: false,
      error: 'Aggregations are disabled',
    }
  }

  // Check if groupBy is allowed
  if (groupByFields && config?.allowGroupBy === false) {
    return {
      valid: false,
      error: 'Group by is disabled',
    }
  }

  // Check max groupBy fields
  if (groupByFields) {
    const fields = Array.isArray(groupByFields)
      ? groupByFields
      : String(groupByFields).split(',').map(f => f.trim())

    const maxFields = config?.maxGroupByFields ?? 5
    if (fields.length > maxFields) {
      return {
        valid: false,
        error: `Group by limited to ${maxFields} fields`,
      }
    }
  }

  // Check if aggregates are provided
  if (!aggregates || aggregates.length === 0) {
    return {
      valid: false,
      error: 'At least one aggregate function is required',
    }
  }

  return { valid: true }
}
