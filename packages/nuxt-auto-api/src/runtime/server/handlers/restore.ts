import type { HandlerContext, SingleResponse } from '../../types'
import { eq, and, isNotNull } from 'drizzle-orm'
import { createError } from 'h3'
import { getSoftDeleteColumn, buildRestoreUpdates } from '../utils/softDelete'
import { assertResourcePermission } from '../utils/permissions'
import { restoreSoftDeletedBatch } from '../utils/softDeleteBatch'
import { recordRevisionIfPresent } from '../utils/revisionRecord'

// Re-export for backward compatibility (was previously defined here).
export { recordRevisionIfPresent } from '../utils/revisionRecord'

/**
 * Restore handler - POST /api/[resource]/[id]/restore
 * Restores a soft-deleted record (clears deletedAt + companion columns). When the row was trashed as
 * part of a cascade batch (has a deletionId), the whole batch is restored so children come back too.
 * Uses the configurable `restore` permission (permissions.restore ?? softDelete.restore ?? update ?? admin).
 */
export async function restoreHandler(context: HandlerContext): Promise<SingleResponse & { restored: boolean }> {
  const { db, schema, params, resource } = context
  const table = schema[resource]
  const id = params.id

  if (!id) throw createError({ statusCode: 400, message: 'ID parameter is required' })

  const softDeleteCol = getSoftDeleteColumn(table)
  if (!softDeleteCol) throw createError({ statusCode: 400, message: 'This resource does not support soft deletes' })

  const [existing] = await db.select().from(table)
    .where(and(eq(table.id, id), isNotNull(table[softDeleteCol])))

  if (!existing) throw createError({ statusCode: 404, message: 'Deleted record not found' })

  // Configurable permission: restore → softDelete.restore → update → admin.
  await assertResourcePermission(resource, 'restore', context, { recordId: id })

  // If this row was trashed as part of a cascade batch, restore the whole batch (parent + children).
  const deletionId = (existing as any).deletionId ?? (existing as any).deletion_id
  if (deletionId) {
    await restoreSoftDeletedBatch(context, String(deletionId))
    const [restored] = await db.select().from(table).where(eq(table.id, id))
    return { data: restored, restored: true }
  }

  // Single-row restore.
  const [restored] = await db.update(table).set(buildRestoreUpdates(table)).where(eq(table.id, id)).returning()
  await recordRevisionIfPresent(context, resource, id, 'restore', restored)

  return { data: restored, restored: true }
}
