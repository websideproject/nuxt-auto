import { eq, and } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { checkObjectLevelAuth } from '../middleware/authz'
import { buildTenantWhere } from '../utils/tenant'
import { executeBeforeHook, executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'

/**
 * Update handler - PATCH /api/[resource]/[id]
 */
export async function updateHandler(context: HandlerContext): Promise<SingleResponse> {
  const { db, schema, params, event, resource } = context

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

  // Check if record exists (with tenant scoping)
  let whereClause = eq(table.id, id)
  if (context.tenant && !context.tenant.canAccessAllTenants) {
    const tenantWhere = buildTenantWhere(table, context.tenant.id, context.tenant.field)
    whereClause = and(whereClause, tenantWhere)
  }

  const [existing] = await db.select().from(table).where(whereClause)

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `${resource} with id ${id} not found`,
    })
  }

  // Check object-level authorization
  await checkObjectLevelAuth(existing, context)

  // Use validated body from validation middleware
  // Note: validation middleware already reads and validates the body
  let data = context.validated.body

  if (!data || typeof data !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Request body is required',
    })
  }

  // Execute beforeUpdate hook (can modify data)
  data = await executeBeforeHook('update', context, data, id)

  // Update the record
  const [updated] = await db
    .update(table)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      message: 'Failed to update record',
    })
  }

  // Execute afterUpdate hook (may transform data)
  let result = await executeAfterHookWithTransform('update', context, updated)

  // Filter hidden fields from response
  const filteredData = filterHiddenFields(result, context)

  return {
    data: filteredData,
  }
}
