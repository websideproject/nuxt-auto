import { eq, and } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext } from '../../types'
import { checkObjectLevelAuth } from '../middleware/authz'
import { getSoftDeleteColumn, buildSoftDeleteUpdates } from '../utils/softDelete'
import { cascadeSoftDelete } from '../utils/softDeleteCascade'
import { buildTenantWhere } from '../utils/tenant'
import { executeBeforeHook, executeAfterHook } from '../utils/executeHooks'
import { assertResourcePermission } from '../utils/permissions'

/**
 * Delete handler - DELETE /api/[resource]/[id]
 *
 * Behavior:
 *  - Table has `deletedAt` column + no `?force=true` → soft delete (stamps deletedAt + deletedBy + deletionId).
 *  - No `deletedAt` column OR `?force=true` → hard delete (permanent).
 *  - `?force=true` requires the `purge` soft-delete permission (gated separately from normal delete).
 */
export async function deleteHandler(context: HandlerContext): Promise<{ success: boolean }> {
  const { db, schema, params, resource, query } = context

  const table = schema[resource]
  if (!table) throw new Error(`Table ${resource} not found in schema`)

  const id = params.id
  if (!id) throw createError({ statusCode: 400, message: 'ID parameter is required' })

  let whereClause = eq(table.id, id)
  if (context.tenant && !context.tenant.canAccessAllTenants) {
    const tenantWhere = buildTenantWhere(table, context.tenant.id, context.tenant.field)
    whereClause = and(whereClause, tenantWhere)
  }

  const [existing] = await db.select().from(table).where(whereClause)
  if (!existing) throw createError({ statusCode: 404, message: `${resource} with id ${id} not found` })

  await checkObjectLevelAuth(existing, context)

  const softDeleteCol = getSoftDeleteColumn(table)
  const wantForce = (query as any)?.force === 'true' || (query as any)?.force === true

  if (softDeleteCol && !wantForce) {
    // SOFT DELETE — stamp deletedAt / deletedBy / deletionId / deletedReason, then cascade to children.
    const deletionId = String((query as any)?.deletionId ?? crypto.randomUUID())
    const reason = (query as any)?.reason ?? null
    ;(context as any)._revOperation = 'soft-delete'
    ;(context as any)._deletionId = deletionId

    await executeBeforeHook('delete', context, undefined, id)

    // Cascade FIRST so a `restrict` child blocks before the parent is stamped.
    const cascade = (context.resourceConfig as any)?.authorization?.softDelete?.cascade
    if (cascade !== 'off') {
      await cascadeSoftDelete(context, resource, id, deletionId, { reason })
    }

    const updates = buildSoftDeleteUpdates(table, {
      deletionId,
      reason,
      userId: context.user?.id ? String(context.user.id) : null,
    })
    await db.update(table).set(updates).where(eq(table.id, id))

    await executeAfterHook('delete', context, undefined, id)

    return { success: true, softDeleted: true, deletionId }
  }

  // HARD DELETE (purge) — requires `purge` permission if table supports soft delete.
  if (softDeleteCol && wantForce) {
    await assertResourcePermission(resource, 'purge', context, { recordId: id })
  }

  ;(context as any)._revOperation = 'delete'
  await executeBeforeHook('delete', context, undefined, id)
  await db.delete(table).where(eq(table.id, id))
  await executeAfterHook('delete', context, undefined, id)

  return { success: true, softDeleted: false }
}
