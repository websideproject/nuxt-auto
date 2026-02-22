import type { HandlerContext, ListResponse } from '../../types'
import { buildWhereClause } from '../utils/buildWhereClause'
import { buildOrderBy } from '../utils/buildOrderBy'
import { buildPagination } from '../utils/buildPagination'
import { buildRelations, createRelationError } from '../utils/buildRelations'
import { filterFields } from '../utils/filterFields'
import { filterRelationFields } from '../utils/filterRelationFields'
import { cleanRelationsConfig } from '../utils/cleanRelationsConfig'
import { encodeCursor, buildCursorWhere } from '../utils/cursor'
import { getSoftDeleteColumn } from '../utils/softDelete'
import { buildTenantWhere } from '../utils/tenant'
import { parseAggregateParam, executeSimpleAggregation, validateAggregation } from '../utils/buildAggregation'
import { executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { serializeResponse } from '../utils/serializeResponse'
import { count, and, isNull } from 'drizzle-orm'

/**
 * List handler - GET /api/[resource]
 */
export async function listHandler(context: HandlerContext): Promise<ListResponse> {
  const { db, schema, fullSchema, query, validated, resource } = context

  // Get the table from schema
  const table = schema[resource]
  if (!table) {
    throw new Error(`Table ${resource} not found in schema`)
  }

  // Use validated query if available
  const effectiveQuery = validated.query || query

  // Parse filter if it's a string
  let filter = effectiveQuery.filter
  if (typeof filter === 'string') {
    try {
      filter = JSON.parse(filter)
    } catch (e) {
      console.warn('[autoApi] Failed to parse filter JSON:', filter)
      filter = undefined
    }
  }

  // Build query components (use fullSchema for relations)
  let whereClause = buildWhereClause(filter as Record<string, any>, table)
  const orderBy = buildOrderBy(effectiveQuery.sort as string | string[], table)
  const pagination = buildPagination(effectiveQuery)
  const relations = buildRelations(effectiveQuery.include as string | string[], fullSchema || schema, resource, db)

  // Check if cursor pagination is requested
  const useCursor = effectiveQuery.cursor !== undefined
  let cursorFields: string[] = ['id'] // default cursor field
  if (effectiveQuery.cursorFields && Array.isArray(effectiveQuery.cursorFields)) {
    cursorFields = effectiveQuery.cursorFields
  }

  // Determine sort direction for cursor
  const sortDirection = orderBy.length > 0 ? 'asc' : 'asc' // TODO: extract from orderBy

  // Add cursor where clause if using cursor pagination
  if (useCursor && effectiveQuery.cursor) {
    const cursorWhere = buildCursorWhere(table, effectiveQuery.cursor as string, cursorFields, sortDirection)
    whereClause = whereClause ? and(whereClause, cursorWhere) : cursorWhere
  }

  // Auto-filter soft-deleted records
  const softDeleteCol = getSoftDeleteColumn(table)
  if (softDeleteCol) {
    const notDeletedClause = isNull(table[softDeleteCol])

    // Include deleted if explicitly requested AND user has permission
    const includeDeleted = effectiveQuery.includeDeleted === true || effectiveQuery.includeDeleted === 'true'
    const canViewDeleted = context.permissions.includes('admin')

    if (!includeDeleted || !canViewDeleted) {
      whereClause = whereClause ? and(whereClause, notDeletedClause) : notDeletedClause
    }
  }

  // Apply tenant scoping if enabled
  if (context.tenant && !context.tenant.canAccessAllTenants) {
    const tenantWhere = buildTenantWhere(table, context.tenant.id, context.tenant.field)
    whereClause = whereClause ? and(whereClause, tenantWhere) : tenantWhere
  }

  // Merge additional filters from plugins (e.g., search)
  if (context.additionalFilters && context.additionalFilters.length > 0) {
    for (const filter of context.additionalFilters) {
      whereClause = whereClause ? and(whereClause, filter) : filter
    }
  }

  // Apply SQL-level list filter from auth config (efficient, pagination-correct)
  if (context.listFilter) {
    const filterClause = context.listFilter(table, context)
    if (filterClause) {
      whereClause = whereClause ? and(whereClause, filterClause) : filterClause
    }
  }

  // Reusable fetch function (used for initial fetch and objectLevel batching)
  const cleanedRelations = relations ? cleanRelationsConfig(relations) : undefined
  const fetchBatch = async (batchLimit: number | undefined, batchOffset: number | undefined): Promise<any[]> => {
    if (relations && db.query && db.query[resource]) {
      const qo: any = {}
      if (whereClause) qo.where = whereClause
      if (orderBy.length > 0) qo.orderBy = orderBy
      if (batchLimit) qo.limit = batchLimit
      if (batchOffset) qo.offset = batchOffset
      if (cleanedRelations) qo.with = cleanedRelations
      return await db.query[resource].findMany(qo)
    } else {
      let qb = db.select().from(table)
      if (whereClause) qb = qb.where(whereClause)
      if (orderBy.length > 0) qb = qb.orderBy(...orderBy)
      if (batchLimit) qb = qb.limit(batchLimit)
      if (batchOffset) qb = qb.offset(batchOffset)
      return await qb
    }
  }

  // Execute query
  let data: any[]
  let hasMore = false
  let nextCursor: string | undefined

  // For cursor pagination, fetch one extra record to check if there are more
  const effectiveLimit = useCursor && pagination.limit ? pagination.limit + 1 : pagination.limit
  const initialOffset = useCursor ? undefined : pagination.offset

  try {
    data = await fetchBatch(effectiveLimit, initialOffset)
  } catch (error: any) {
    // Check if it's a relation error
    if (relations && error.message && (
      error.message.includes('relation') ||
      error.message.includes('with') ||
      error.message.includes('is not defined')
    )) {
      const includeStr = effectiveQuery.include as string
      const firstRelation = Array.isArray(includeStr)
        ? includeStr[0]
        : String(includeStr).split(',')[0].split('.')[0].replace(/[\[{].*/, '').trim()

      throw createRelationError(firstRelation, resource, error)
    }
    throw error
  }

  // Object-level post-filtering for list operations.
  // Keeps fetching batches until we have enough items or exhaust the dataset.
  // Skipped when listFilter was applied (SQL already filtered — no need to post-filter).
  const needsObjectFilter = context.objectLevelCheck && !context.listFilter
  if (needsObjectFilter) {
    const target = effectiveLimit || data.length
    const filtered: any[] = []
    let batchOffset = (initialOffset || 0) + data.length
    let batch = data
    const MAX_BATCHES = 20

    for (let i = 0; i < MAX_BATCHES; i++) {
      for (const item of batch) {
        if (await context.objectLevelCheck!(item, context)) {
          filtered.push(item)
          if (filtered.length >= target) break
        }
      }

      // Stop if we have enough or this batch was smaller than requested (no more data)
      if (filtered.length >= target || batch.length < target) break

      batch = await fetchBatch(target, batchOffset)
      if (batch.length === 0) break
      batchOffset += batch.length
    }

    data = filtered
  }

  // Handle cursor pagination response
  if (useCursor && pagination.limit) {
    hasMore = data.length > pagination.limit
    if (hasMore) {
      data = data.slice(0, -1) // Remove the extra record
      nextCursor = encodeCursor(data[data.length - 1], cursorFields)
    }
  }

  // Get total count if paginated
  let total: number | undefined
  if (effectiveQuery.page !== undefined) {
    const countQuery = db.select({ count: count() }).from(table)
    if (whereClause) {
      countQuery.where(whereClause)
    }
    const [result] = await countQuery
    total = result?.count
  }

  // Filter relation fields based on enhanced include syntax (author[id,name])
  let filteredData = filterRelationFields(data, relations)

  // Filter hidden fields (including nested relations)
  filteredData = filterHiddenFields(filteredData, context)

  // Filter fields if requested (applies to root resource only, preserves relations)
  if (effectiveQuery.fields) {
    filteredData = filterFields(filteredData, effectiveQuery.fields as string | string[])
  }

  // Execute simple aggregation if requested (no groupBy)
  let aggregates: Record<string, any> | undefined
  if (effectiveQuery.aggregate && !effectiveQuery.groupBy) {
    try {
      const aggregateList = parseAggregateParam(effectiveQuery.aggregate as string)
      const validation = validateAggregation(aggregateList)

      if (validation.valid) {
        aggregates = await executeSimpleAggregation(db, table, aggregateList, whereClause)
      } else {
        console.warn(`[autoApi] Aggregation validation failed: ${validation.error}`)
      }
    } catch (error) {
      console.error('[autoApi] Aggregation error:', error)
    }
  }

  // Execute afterList hook (may transform data)
  filteredData = await executeAfterHookWithTransform('list', context, filteredData)

  // Serialize data (convert Date objects to ISO strings)
  const serializedData = serializeResponse(filteredData)

  // Build response
  const response: ListResponse = {
    data: serializedData,
    meta: {
      limit: pagination.limit,
    },
  }

  // Add aggregates to metadata
  if (aggregates) {
    response.meta.aggregates = serializeResponse(aggregates)
  }

  if (useCursor) {
    // Cursor pagination metadata
    response.meta.hasMore = hasMore
    if (nextCursor) {
      response.meta.nextCursor = nextCursor
    }
  } else if (effectiveQuery.page !== undefined) {
    // Offset pagination metadata
    response.meta.page = effectiveQuery.page as number
    response.meta.total = total
  }

  return response
}
