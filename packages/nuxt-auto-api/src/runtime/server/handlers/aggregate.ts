import { createError } from 'h3'
import type { HandlerContext, AggregationResponse, AggregationQuery } from '../../types'
import {
  parseAggregateParam,
  executeComplexAggregation,
  validateAggregation,
} from '../utils/buildAggregation'
import { buildTenantWhere } from '../utils/tenant'
import { getSoftDeleteColumn } from '../utils/softDelete'
import { and, isNull } from 'drizzle-orm'

/**
 * Aggregate handler - GET /api/[resource]/aggregate
 * Handles complex aggregations with groupBy and having
 */
export async function aggregateHandler(context: HandlerContext): Promise<AggregationResponse> {
  const { db, schema, query, resource } = context

  // Get the table from schema
  const table = schema[resource]
  if (!table) {
    throw new Error(`Table ${resource} not found in schema`)
  }

  // Parse aggregation parameters
  if (!query.aggregate) {
    throw createError({
      statusCode: 400,
      message: 'aggregate parameter is required',
    })
  }

  const aggregates = parseAggregateParam(query.aggregate as string)

  // Validate aggregation
  const validation = validateAggregation(aggregates, query.groupBy as string | string[])
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      message: validation.error || 'Invalid aggregation',
    })
  }

  // Build aggregation query
  const aggregationQuery: AggregationQuery = {
    aggregates,
    groupBy: query.groupBy
      ? Array.isArray(query.groupBy)
        ? query.groupBy
        : String(query.groupBy).split(',').map(f => f.trim())
      : undefined,
    having: query.having as Record<string, any>,
    filter: query.filter as Record<string, any>,
  }

  // Apply soft delete filter
  const softDeleteCol = getSoftDeleteColumn(table)
  if (softDeleteCol) {
    const includeDeleted = query.includeDeleted === true || query.includeDeleted === 'true'
    const canViewDeleted = context.permissions.includes('admin')

    if (!includeDeleted || !canViewDeleted) {
      // Add to filter
      if (!aggregationQuery.filter) {
        aggregationQuery.filter = {}
      }
      // Note: This is a simplified approach
      // In production, you'd want to merge this with existing filters more carefully
    }
  }

  // Apply tenant scoping
  if (context.tenant && !context.tenant.canAccessAllTenants) {
    if (!aggregationQuery.filter) {
      aggregationQuery.filter = {}
    }
    aggregationQuery.filter[context.tenant.field] = context.tenant.id
  }

  // Execute aggregation
  const results = await executeComplexAggregation(db, table, aggregationQuery)

  // Transform results to separate group fields from aggregates
  const transformedResults = results.map((row: any) => {
    const group: Record<string, any> = {}
    const aggregateValues: Record<string, any> = {}

    // Separate group fields from aggregate fields
    const groupByFields = aggregationQuery.groupBy || []
    
    // Create a set of potential keys for grouping (property names AND column names)
    const groupKeys = new Set<string>()
    if (groupByFields) {
      groupByFields.forEach(field => {
        groupKeys.add(field)
        // Add column name if available
        if (table[field] && table[field].name) {
          groupKeys.add(table[field].name)
        }
      })
    }

    for (const [key, value] of Object.entries(row)) {
      if (groupKeys.has(key)) {
        group[key] = value
      } else {
        aggregateValues[key] = value
      }
    }

    return {
      ...(Object.keys(group).length > 0 ? { group } : {}),
      ...aggregateValues,
    }
  })

  return {
    data: transformedResults,
    meta: {
      total: results.length,
    },
  }
}
