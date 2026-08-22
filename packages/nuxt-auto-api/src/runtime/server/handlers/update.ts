import { eq, and } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { checkObjectLevelAuth } from '../middleware/authz'
import { buildTenantWhere } from '../utils/tenant'
import { getSoftDeleteColumn, canViewSoftDeleted } from '../utils/softDelete'
import { executeBeforeHook, executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { assertWritableFields, filterReadableFields } from '../utils/fieldPermissions'
import { parseJsonColumns } from '../utils/parseJsonColumns'

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

  // A trashed row is not editable through the normal update path — it's "gone" until restored.
  // (Restoring goes through the dedicated restore endpoint.) Hidden unless the caller may view trash.
  const softDeleteCol = getSoftDeleteColumn(table)
  if (softDeleteCol && existing[softDeleteCol] != null && !(await canViewSoftDeleted(context))) {
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

  // Refuse fields the CALLER may not write — before the hook, for the reason given in create.ts.
  await assertWritableFields(data, context)

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

  // Parse JSON columns before hooks see them
  const parsedUpdated = parseJsonColumns(updated, context)

  // Execute afterUpdate hook (may transform data)
  const result = await executeAfterHookWithTransform('update', context, parsedUpdated)

  // Filter hidden fields from response
  let filteredData = filterHiddenFields(result, context)
  filteredData = await filterReadableFields(filteredData, context)

  return {
    data: filteredData,
  }
}
