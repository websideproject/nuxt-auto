import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { resolveObjectPermission } from '../middleware/resolveObjectPermission'
import { getAuthConfig } from './authConfig'
import { coerceId, primaryKeyColumn } from './table'
import { getSoftDeleteColumn } from './softDelete'
import type {
  ResourceAuthConfig,
  HandlerContext,
  PermissionCheckResult,
  PermissionValue,
} from '../../types'

/**
 * The permission keys auto-api evaluates. `restore`, `purge`, `viewDeleted` and `aggregate` fall back to a
 * base operation when not declared (see `resolvePermission`).
 */
export type PermissionOperation = 'read' | 'create' | 'update' | 'delete' | 'restore' | 'purge' | 'viewDeleted' | 'aggregate'

/**
 * The permission value that governs `operation` on a resource.
 *
 *  - `restore`     → `permissions.restore` → `softDelete.restore` → `update`
 *  - `purge`       → `permissions.purge`   → `softDelete.purge`   → `delete`
 *  - `viewDeleted` → `permissions.viewDeleted` → `softDelete.viewDeleted` → the restore permission
 *  - `aggregate`   → `permissions.aggregate` → `read`
 *
 * `undefined` means nothing was declared — which is a denial.
 */
export function resolvePermission(auth: ResourceAuthConfig | undefined, operation: PermissionOperation): PermissionValue | undefined {
  const p = auth?.permissions as Record<string, any> | undefined
  const sd = auth?.softDelete as Record<string, any> | undefined
  switch (operation) {
    case 'restore': return p?.restore ?? sd?.restore ?? p?.update
    case 'purge': return p?.purge ?? sd?.purge ?? p?.delete
    case 'viewDeleted': return p?.viewDeleted ?? sd?.viewDeleted ?? resolvePermission(auth, 'restore')
    case 'aggregate': return p?.aggregate ?? p?.read
    default: return p?.[operation]
  }
}

/**
 * Evaluate one permission value. **Deny by default:** a value that was never declared is `false`.
 *
 *  - `true` / `false`  → allow / deny everyone (`false` is absolute — not even `*` passes it)
 *  - `'perm'` / `[...]` → the caller holds that permission / any of them
 *  - `(ctx) => boolean` → the function decides
 *  - `{ ... }`          → a registered permission evaluator decides (fails closed when none does)
 *
 * A caller holding the `*` permission (a super-admin) passes every value except an explicit `false` —
 * including operations a resource never declared. Field-level gates pass `{ wildcard: false }`: a field
 * declared `read: () => false` is hidden from everyone.
 */
export async function evaluatePermission(
  permission: PermissionValue | undefined | null,
  context: HandlerContext,
  opts: { wildcard?: boolean } = {},
): Promise<boolean> {
  if (permission === false) return false
  if (permission === true) return true

  const held = context.permissions || []
  if (opts.wildcard !== false && held.includes('*')) return true
  if (permission === undefined || permission === null) return false

  if (typeof permission === 'function') return !!(await permission(context))
  if (typeof permission === 'string') return held.includes(permission)
  if (Array.isArray(permission)) return permission.some(p => held.includes(p))
  if (typeof permission === 'object') return await resolveObjectPermission(permission as Record<string, any>, context)
  return false
}

/** Whether the caller may perform `operation` under `authConfig`. */
export async function checkPermission(
  operation: PermissionOperation,
  authConfig: ResourceAuthConfig | undefined,
  context: HandlerContext,
): Promise<boolean> {
  return evaluatePermission(resolvePermission(authConfig, operation), context)
}

/**
 * Throw 401 (anonymous) or 403 (signed in) unless the caller may perform `operation`.
 */
export async function assertPermission(
  operation: PermissionOperation,
  authConfig: ResourceAuthConfig | undefined,
  context: HandlerContext,
  label: string = context.resource,
): Promise<void> {
  if (await checkPermission(operation, authConfig, context)) return
  throw createError({
    statusCode: context.user ? 403 : 401,
    message: context.user
      ? `Forbidden: you don't have permission to ${operation === 'read' ? 'read' : operation} ${label}`
      : 'Authentication required',
  })
}

/**
 * Field-level permission. A field with no rule for `operation` is unrestricted — the operation-level gate
 * already decided whether the caller may touch the resource at all. Declared rules ignore the `*` wildcard.
 */
export async function checkFieldPermission(
  field: string,
  operation: 'read' | 'write',
  authConfig: ResourceAuthConfig | undefined,
  context: HandlerContext,
): Promise<boolean> {
  const rule = authConfig?.fields?.[field]?.[operation]
  if (rule === undefined) return true
  return evaluatePermission(rule, context, { wildcard: false })
}

/** What the caller may do on a resource — the same evaluator the request pipeline enforces with. */
export async function getResourcePermissions(
  authConfig: ResourceAuthConfig | undefined,
  context: HandlerContext,
): Promise<PermissionCheckResult> {
  // Restore, purge and the trash exist only on a soft-deletable table (they fall back to `update` / `delete`,
  // which would otherwise report them as allowed on a table that has no trash at all).
  const table = context.schema?.[context.resource]
  const softDeletable = !table || !!getSoftDeleteColumn(table)
  const result: PermissionCheckResult = {
    canCreate: await checkPermission('create', authConfig, context),
    canRead: await checkPermission('read', authConfig, context),
    canUpdate: await checkPermission('update', authConfig, context),
    canDelete: await checkPermission('delete', authConfig, context),
    canRestore: softDeletable && await checkPermission('restore', authConfig, context),
    canPurge: softDeletable && await checkPermission('purge', authConfig, context),
    canViewDeleted: softDeletable && await checkPermission('viewDeleted', authConfig, context),
  }

  if (authConfig?.fields) {
    result.fields = {}
    for (const fieldName of Object.keys(authConfig.fields)) {
      result.fields[fieldName] = {
        canRead: await checkFieldPermission(fieldName, 'read', authConfig, context),
        canWrite: await checkFieldPermission(fieldName, 'write', authConfig, context),
      }
    }
  }
  return result
}

/**
 * Assert that the caller may perform `operation` on `resource` (any registered resource, not only the one
 * the request is for), optionally also running that resource's `objectLevel` check against `recordId`.
 *
 * For custom endpoints that act on a resource outside the generated routes (e.g. restoring a revision).
 */
export async function assertResourcePermission(
  resource: string,
  operation: PermissionOperation,
  context: HandlerContext,
  opts: { recordId?: string | number } = {},
): Promise<void> {
  if (!context.registry) {
    try {
      const { registry } = await (import('#nuxt-auto-api-registry' as string) as any)
      context = { ...context, registry }
    }
    catch {
      // No registry (isolated unit test): no declaration → denied below.
    }
  }

  const authConfig = getAuthConfig(context, resource)
  await assertPermission(operation, authConfig, context, resource)

  if (opts.recordId !== undefined && authConfig?.objectLevel) {
    const table = context.schema?.[resource] ?? context.registry?.[resource]?.schema
    if (!table || !context.db) return
    const pk = primaryKeyColumn(table)
    const [record] = await context.db.select().from(table).where(eq(pk, coerceId(table, opts.recordId, resource))).limit(1)
    if (record && !(await authConfig.objectLevel(record, { ...context, resource }))) {
      throw createError({ statusCode: 403, message: 'Forbidden: insufficient object-level permission' })
    }
  }
}
