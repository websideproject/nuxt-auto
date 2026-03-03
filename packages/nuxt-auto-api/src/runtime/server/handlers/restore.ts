import type { HandlerContext, SingleResponse } from '../../types'
import { eq, and, isNotNull } from 'drizzle-orm'
import { createError } from 'h3'
import { getSoftDeleteColumn } from '../utils/softDelete'

/**
 * Restore handler - POST /api/[resource]/[id]/restore
 * Restores a soft-deleted record by setting deletedAt to null
 */
export async function restoreHandler(context: HandlerContext): Promise<SingleResponse & { restored: boolean }> {
  const { db, schema, params, resource } = context
  const table = schema[resource]
  const id = params.id

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID parameter is required',
    })
  }

  // Check if resource supports soft delete
  const softDeleteCol = getSoftDeleteColumn(table)
  if (!softDeleteCol) {
    throw createError({
      statusCode: 400,
      message: 'This resource does not support soft deletes',
    })
  }

  // Find soft-deleted record
  const [existing] = await db.select().from(table)
    .where(and(
      eq(table.id, id),
      isNotNull(table[softDeleteCol])
    ))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Deleted record not found',
    })
  }

  // Check authorization (only admins can restore by default)
  if (!context.permissions.includes('admin')) {
    throw createError({
      statusCode: 403,
      message: 'Only admins can restore deleted records',
    })
  }

  // Restore: set deletedAt to null
  const [restored] = await db.update(table)
    .set({ [softDeleteCol]: null })
    .where(eq(table.id, id))
    .returning()

  return {
    data: restored,
    restored: true,
  }
}
