import { eq, and } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { buildRelations, createRelationError } from '../utils/buildRelations'
import { filterFields } from '../utils/filterFields'
import { filterRelationFields } from '../utils/filterRelationFields'
import { cleanRelationsConfig } from '../utils/cleanRelationsConfig'
import { checkObjectLevelAuth } from '../middleware/authz'
import { getSoftDeleteColumn } from '../utils/softDelete'
import { buildTenantWhere } from '../utils/tenant'
import { executeBeforeHook, executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { serializeResponse } from '../utils/serializeResponse'

/**
 * Get single handler - GET /api/[resource]/[id]
 */
export async function getHandler(context: HandlerContext): Promise<SingleResponse> {
  const { db, schema, fullSchema, params, query, validated, resource } = context

  // Get the table from schema
  const table = schema[resource]
  if (!table) {
    throw new Error(`Table ${resource} not found in schema`)
  }

  // Get the ID from params
  const id = params.id
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID parameter is required',
    })
  }

  // Execute beforeGet hook
  await executeBeforeHook('get', context, undefined, id)

  // Use validated query if available
  const effectiveQuery = validated.query || query

  // Build the query (use fullSchema for relations)
  const relations = buildRelations(effectiveQuery.include as string | string[], fullSchema || schema, resource, db)

  // Build where clause with tenant scoping
  // Parse id as number if it's numeric, otherwise use as string
  const parsedId = /^\d+$/.test(id) ? parseInt(id, 10) : id
  let whereClause = eq(table.id, parsedId)
  if (context.tenant && !context.tenant.canAccessAllTenants) {
    const tenantWhere = buildTenantWhere(table, context.tenant.id, context.tenant.field)
    whereClause = and(whereClause, tenantWhere)
  }

  // Execute query
  let data

  try {
    if (relations && db.query && db.query[resource]) {
      // Use query API for relations
      const queryOptions: any = {
        where: whereClause,
      }

      if (relations) {
        // Clean relations config (remove _selectFields metadata before passing to Drizzle)
        queryOptions.with = cleanRelationsConfig(relations)
      }

      data = await db.query[resource].findFirst(queryOptions)
    } else {
      // Use select API for simple queries
      const [result] = await db.select().from(table).where(whereClause)
      data = result
    }
  } catch (error: any) {
    // Check if it's a relation error
    if (relations && error.message && (
      error.message.includes('relation') ||
      error.message.includes('with') ||
      error.message.includes('is not defined')
    )) {
      // Extract the relation name from the include parameter
      const includeStr = effectiveQuery.include as string
      const firstRelation = Array.isArray(includeStr)
        ? includeStr[0]
        : String(includeStr).split(',')[0].split('.')[0].replace(/[\[{].*/, '').trim()

      throw createRelationError(firstRelation, resource, error)
    }
    // Re-throw other errors
    throw error
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      message: `${resource} with id ${id} not found`,
    })
  }

  // Check if soft-deleted
  const softDeleteCol = getSoftDeleteColumn(table)
  if (softDeleteCol && data[softDeleteCol] !== null) {
    // Record is soft-deleted, only return if user has permission
    if (!context.permissions.includes('admin')) {
      throw createError({
        statusCode: 404,
        message: `${resource} with id ${id} not found`,
      })
    }
  }

  // Check object-level authorization
  await checkObjectLevelAuth(data, context)

  // Filter relation fields based on enhanced include syntax (author[id,name])
  let filteredData = filterRelationFields(data, relations)

  // Filter hidden fields (including nested relations)
  filteredData = filterHiddenFields(filteredData, context)

  // Filter fields if requested (applies to root resource only, preserves relations)
  if (effectiveQuery.fields) {
    filteredData = filterFields(filteredData, effectiveQuery.fields as string | string[])
  }

  // Execute afterGet hook (may transform data)
  filteredData = await executeAfterHookWithTransform('get', context, filteredData)

  // Serialize response (convert Date objects to ISO strings)
  const serialized = serializeResponse(filteredData)

  return {
    data: serialized,
  }
}
