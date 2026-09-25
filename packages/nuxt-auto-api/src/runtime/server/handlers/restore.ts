import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { getSoftDeleteColumn, buildRestoreUpdates } from '../utils/softDelete'
import { restoreSoftDeletedBatch } from '../utils/softDeleteBatch'
import { recordRevisionIfPresent } from '../utils/revisionRecord'
import { findAuthorizedRow } from '../utils/rowAccess'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { filterReadableFields } from '../utils/fieldPermissions'
import { serializeResponse } from '../utils/serializeResponse'
import { primaryKeyColumn, primaryKeyName } from '../utils/table'
import { assertResourcePermission } from '../utils/permissions'

export { recordRevisionIfPresent } from '../utils/revisionRecord'

/**
 * Restore handler - POST /api/[resource]/[id]/restore
 *
 * The `restore` permission (→ `softDelete.restore` → `update`) is checked before anything is looked up. The row must be
 * trashed and visible to the caller (tenant, listFilter, objectLevel). A row trashed as part of a cascade
 * batch restores its whole batch — every row of which must pass the same checks.
 */
export async function restoreHandler(context: HandlerContext): Promise<SingleResponse & { restored: boolean }> {
  const { db, schema, params, resource } = context
  const table = schema[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
  if (!params.id) throw createError({ statusCode: 400, message: 'ID parameter is required' })

  const softCol = getSoftDeleteColumn(table)
  if (!softCol) throw createError({ statusCode: 400, message: 'This resource does not support soft deletes' })

  await assertResourcePermission(resource, 'restore', context)

  const existing = await findAuthorizedRow(context, resource, params.id, { softDeleted: 'only' })
  const id = existing[primaryKeyName(table)]
  const pkWhere = eq(primaryKeyColumn(table), id)

  const deletionId = existing.deletionId ?? existing.deletion_id
  if (deletionId) {
    await restoreSoftDeletedBatch(context, String(deletionId))
  }
  else {
    await db.update(table).set(buildRestoreUpdates(table)).where(pkWhere)
  }

  const [restored] = await db.select().from(table).where(pkWhere).limit(1)
  if (!deletionId) await recordRevisionIfPresent(context, resource, id, 'restore', restored)

  let out: any = filterHiddenFields(restored, context)
  out = await filterReadableFields(out, context)
  return { data: serializeResponse(out), restored: true }
}
