import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext } from '../../types'
import { findAuthorizedRow } from '../utils/rowAccess'
import { getSoftDeleteColumn, buildSoftDeleteUpdates } from '../utils/softDelete'
import { planCascadeSoftDelete } from '../utils/softDeleteCascade'
import { atomicWritesFor } from '../utils/atomicWrites'
import { executeBeforeHook, executeAfterHook } from '../utils/executeHooks'
import { assertResourcePermission } from '../utils/permissions'
import { getAuthConfig } from '../utils/authConfig'
import { primaryKeyColumn, primaryKeyName } from '../utils/table'

const truthy = (v: unknown) => v === true || v === 'true' || v === '1'

/**
 * Delete handler - DELETE /api/[resource]/[id]
 *
 *  - soft-deletable table, no `?force=true` → soft delete: stamps the marker + `deletedBy` / `deletionId` /
 *    `deletedReason` (`?reason=`), cascading to children under one server-generated `deletionId`
 *  - otherwise → hard delete. `?force=true` on a soft-deletable table is a **purge** and needs the `purge`
 *    permission (→ `softDelete.purge` → `delete`); it also reaches rows already in the trash.
 */
export async function deleteHandler(context: HandlerContext): Promise<{ success: boolean, softDeleted: boolean, deletionId?: string }> {
  const { db, schema, params, resource, query } = context
  const table = schema[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
  if (!params.id) throw createError({ statusCode: 400, message: 'ID parameter is required' })

  const softCol = getSoftDeleteColumn(table)
  const purge = !!softCol && truthy((query as any)?.force)
  if (purge) await assertResourcePermission(resource, 'purge', context)

  const existing = await findAuthorizedRow(context, resource, params.id, { softDeleted: purge ? 'include' : 'exclude' })
  const id = existing[primaryKeyName(table)]
  const pkWhere = eq(primaryKeyColumn(table), id)

  if (softCol && !purge) {
    const deletionId = crypto.randomUUID()
    const reason = (query as any)?.reason ? String((query as any).reason) : null
    ;(context as any)._revOperation = 'soft-delete'
    ;(context as any)._deletionId = deletionId

    await executeBeforeHook('delete', context, undefined, id)
    // A `restrict` child throws here, before anything is written; the cascade and the row itself are then
    // written together (a transaction, or one batch on D1).
    const cascade = getAuthConfig(context, resource)?.softDelete?.cascade
    const { writes } = cascade !== 'off' ? await planCascadeSoftDelete(context, resource, id, deletionId, { reason }) : { writes: [] }
    const stamp = buildSoftDeleteUpdates(table, { deletionId, reason, userId: context.user?.id != null ? String(context.user.id) : null })
    await atomicWritesFor(context, [...writes, tx => tx.update(table).set(stamp).where(pkWhere)])
    await executeAfterHook('delete', context, undefined, id)
    return { success: true, softDeleted: true, deletionId }
  }

  ;(context as any)._revOperation = 'delete'
  await executeBeforeHook('delete', context, undefined, id)
  await db.delete(table).where(pkWhere)
  await executeAfterHook('delete', context, undefined, id)
  return { success: true, softDeleted: false }
}
