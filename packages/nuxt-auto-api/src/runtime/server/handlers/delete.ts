import { eq, and } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext } from '../../types'
import { checkObjectLevelAuth } from '../middleware/authz'
import { getSoftDeleteColumn } from '../utils/softDelete'
import { buildTenantWhere } from '../utils/tenant'
import { executeBeforeHook, executeAfterHook } from '../utils/executeHooks'

/**
 * Delete handler - DELETE /api/[resource]/[id]
 */
export async function deleteHandler(context: HandlerContext): Promise<{ success: boolean }> {
  const { db, schema, params, resource } = context

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

  // Execute beforeDelete hook
  await executeBeforeHook('delete', context, undefined, id)

  // Check if soft delete is supported
  const softDeleteCol = getSoftDeleteColumn(table)

  if (softDeleteCol) {
    // Soft delete: set deletedAt timestamp
    await db.update(table)
      .set({ [softDeleteCol]: new Date() })
      .where(eq(table.id, id))

    // Execute afterDelete hook
    await executeAfterHook('delete', context, undefined, id)

    return {
      success: true,
      softDeleted: true,
      message: 'Record marked as deleted',
    }
  } else {
    // Hard delete: actually remove the record
    await db.delete(table).where(eq(table.id, id))

    // Execute afterDelete hook
    await executeAfterHook('delete', context, undefined, id)

    return {
      success: true,
      softDeleted: false,
      message: 'Record permanently deleted',
    }
  }
}
