import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, M2MListResponse, M2MListQuery } from '../../../types'
import { detectJunction, validateJunctionConfig } from '../../utils/m2m/detectJunction'
import { validateResourceExists } from '../../utils/m2m/validateM2M'
import { buildM2MPermissionContext, checkM2MPermissions } from '../../utils/m2m/permissions'
import { buildWhereClause } from '../../utils/buildWhereClause'
import { buildOrderBy } from '../../utils/buildOrderBy'
import { serializeResponse } from '../../utils/serializeResponse'

/**
 * List M2M relations handler
 * GET /api/{resource}/{id}/relations/{relation}
 */
export async function m2mListHandler(context: HandlerContext): Promise<M2MListResponse> {
  const { db, schema, params, query, validated, resource } = context

  // Get parameters
  const leftId = params.id
  const relation = params.relation

  if (!leftId) {
    throw createError({
      statusCode: 400,
      message: 'Resource ID is required',
    })
  }

  if (!relation) {
    throw createError({
      statusCode: 400,
      message: 'Relation name is required',
    })
  }

  // Validate relation resource exists
  validateResourceExists(schema, relation)

  // Use validated query if available
  const effectiveQuery = (validated.query || query) as M2MListQuery

  // Detect junction table
  const junction = detectJunction(schema, resource, relation)
  validateJunctionConfig(junction, schema)

  // Verify left record exists
  const leftTable = schema[resource]
  const parsedLeftId = /^\d+$/.test(leftId) ? parseInt(leftId, 10) : leftId
  const [leftRecord] = await db
    .select()
    .from(leftTable)
    .where(eq(leftTable.id, parsedLeftId))
    .limit(1)

  if (!leftRecord) {
    throw createError({
      statusCode: 404,
      message: `${resource} with id ${leftId} not found`,
    })
  }

  // Check M2M permissions
  const permissionContext = buildM2MPermissionContext(context, {
    relation,
    relationResource: relation,
    ids: [], // No specific IDs for list operation
    junction: {
      tableName: junction.tableName,
      leftKey: junction.leftKey,
      rightKey: junction.rightKey,
    },
    leftRecord,
    operation: 'list',
  })

  await checkM2MPermissions(permissionContext)

  // Get junction records
  const junctionTable = junction.table
  const includeRecords = effectiveQuery.includeRecords === true ||
    effectiveQuery.includeRecords === 'true'
  const includeMetadata = effectiveQuery.includeMetadata === true ||
    effectiveQuery.includeMetadata === 'true'

  // Query junction table
  let junctionQuery = db
    .select()
    .from(junctionTable)
    .where(eq(junctionTable[junction.leftKey], parsedLeftId))

  // Apply limit/offset if provided
  if (effectiveQuery.limit) {
    junctionQuery = junctionQuery.limit(effectiveQuery.limit)
  }
  if (effectiveQuery.offset) {
    junctionQuery = junctionQuery.offset(effectiveQuery.offset)
  }

  const junctionRecords = await junctionQuery

  // Extract IDs
  const ids = junctionRecords.map((r: any) => r[junction.rightKey])

  // If no records needed, return just IDs
  if (!includeRecords) {
    return {
      ids,
      total: ids.length,
      meta: {
        limit: effectiveQuery.limit,
        offset: effectiveQuery.offset,
      },
    }
  }

  // Fetch related records if requested
  let records = []
  if (ids.length > 0) {
    const relatedTable = schema[relation]
    let relatedQuery = db
      .select()
      .from(relatedTable)
      .where(eq(relatedTable.id, ids.length === 1 ? ids[0] : undefined))

    // Use inArray for multiple IDs
    if (ids.length > 1) {
      const { inArray } = await import('drizzle-orm')
      relatedQuery = db
        .select()
        .from(relatedTable)
        .where(inArray(relatedTable.id, ids))
    }

    // Apply filters if provided
    if (effectiveQuery.filter) {
      const whereClause = buildWhereClause(effectiveQuery.filter, relatedTable)
      if (whereClause) {
        relatedQuery = relatedQuery.where(whereClause)
      }
    }

    // Apply sorting if provided
    if (effectiveQuery.sort) {
      const orderBy = buildOrderBy(effectiveQuery.sort, relatedTable)
      if (orderBy.length > 0) {
        relatedQuery = relatedQuery.orderBy(...orderBy)
      }
    }

    records = await relatedQuery

    // Filter fields if requested
    if (effectiveQuery.fields) {
      const fields = Array.isArray(effectiveQuery.fields)
        ? effectiveQuery.fields
        : String(effectiveQuery.fields).split(',').map(f => f.trim())

      records = records.map((record: any) => {
        const filtered: any = {}
        for (const field of fields) {
          if (field in record) {
            filtered[field] = record[field]
          }
        }
        return filtered
      })
    }
  }

  // Build response
  const response: M2MListResponse = {
    ids,
    records: serializeResponse(records),
    total: ids.length,
    meta: {
      limit: effectiveQuery.limit,
      offset: effectiveQuery.offset,
      hasMore: effectiveQuery.limit ? ids.length >= effectiveQuery.limit : false,
    },
  }

  // Include metadata if requested
  if (includeMetadata && junction.metadataColumns.length > 0) {
    response.metadata = junctionRecords.map((r: any) => {
      const meta: any = {}
      for (const col of junction.metadataColumns) {
        if (col in r) {
          meta[col] = r[col]
        }
      }
      return meta
    })
  }

  return response
}
