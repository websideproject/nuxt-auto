import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { resolveObjectPermission } from '../middleware/resolveObjectPermission'
import type {
  ResourceAuthConfig,
  HandlerContext,
  PermissionCheckResult,
  PermissionFunction,
  PermissionObject,
} from '../../types'

/**
 * Check if a permission string/function/object evaluates to true.
 * Same logic the request gate uses (see `hasPermission`), so the `/api/permissions`
 * introspection endpoint reflects object (descriptor) gates identically.
 */
export async function evaluatePermission(
  permission: string | string[] | PermissionFunction | PermissionObject | undefined,
  context: HandlerContext,
): Promise<boolean> {
  if (!permission) {
    return true // No permission required = allowed
  }

  // Function-based permission
  if (typeof permission === 'function') {
    return await permission(context)
  }

  // Structured (object) permission → registered evaluator chain (generic seam)
  if (typeof permission === 'object' && !Array.isArray(permission)) {
    return await resolveObjectPermission(permission as Record<string, any>, context)
  }

  // String or array of permission strings
  const requiredPermissions = Array.isArray(permission) ? permission : [permission]
  const userPermissions = context.permissions || []

  // User must have at least one of the required permissions
  return requiredPermissions.some(p => userPermissions.includes(p))
}

/**
 * Check if user has permission for a specific operation
 */
export async function checkPermission(
  operation: 'create' | 'read' | 'update' | 'delete',
  authConfig: ResourceAuthConfig | undefined,
  context: HandlerContext,
): Promise<boolean> {
  if (!authConfig || !authConfig.permissions) {
    return true // No auth config = allowed
  }

  const permission = authConfig.permissions[operation]
  return await evaluatePermission(permission, context)
}

/**
 * Check if user has permission for a specific field operation
 */
export async function checkFieldPermission(
  field: string,
  operation: 'read' | 'write',
  authConfig: ResourceAuthConfig | undefined,
  context: HandlerContext,
): Promise<boolean> {
  if (!authConfig || !authConfig.fields || !authConfig.fields[field]) {
    return true // No field-level auth = allowed
  }

  const fieldConfig = authConfig.fields[field]
  const permission = fieldConfig[operation]

  return await evaluatePermission(permission, context)
}

/**
 * Get all permissions for a resource based on current user context
 */
export async function getResourcePermissions(
  authConfig: ResourceAuthConfig | undefined,
  context: HandlerContext,
): Promise<PermissionCheckResult> {
  const canCreate = await checkPermission('create', authConfig, context)
  const canRead = await checkPermission('read', authConfig, context)
  const canUpdate = await checkPermission('update', authConfig, context)
  const canDelete = await checkPermission('delete', authConfig, context)

  const result: PermissionCheckResult = {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
  }

  // Check field-level permissions if configured
  if (authConfig?.fields) {
    result.fields = {}

    for (const [fieldName, fieldConfig] of Object.entries(authConfig.fields)) {
      const canReadField = await checkFieldPermission(fieldName, 'read', authConfig, context)
      const canWriteField = await checkFieldPermission(fieldName, 'write', authConfig, context)

      result.fields[fieldName] = {
        canRead: canReadField,
        canWrite: canWriteField,
      }
    }
  }

  return result
}

/**
 * Assert that the current user has `operation` permission on `resource`, optionally
 * checking the object-level gate against `recordId`. Throws 401/403 on failure.
 *
 * Used by custom endpoints (e.g. restore) that must authorize against a *different*
 * resource's permission than the one they are registered under.
 *
 * The operation map: 'restore' and 'purge' fall back to 'update' / 'delete'
 * unless the resource's auth config has a dedicated `softDelete.restore` / `softDelete.purge`.
 */
export async function assertResourcePermission(
  resource: string,
  operation: 'create' | 'read' | 'update' | 'delete' | 'restore' | 'purge',
  context: HandlerContext,
  opts: { recordId?: string | number } = {},
): Promise<void> {
  // Look up the resource's auth config from the registry (virtual module, runtime-only).
  // Resilient: if the registry can't be loaded (e.g. isolated unit tests), treat it as
  // "no explicit config" and fall back to the safe defaults below — restore/purge must
  // never fail *open* just because the registry wasn't reachable.
  let authConfig: ResourceAuthConfig | undefined
  try {
    const { registry } = await (import('#nuxt-auto-api-registry' as string) as any)
    authConfig = registry?.[resource]?.authorization
  }
  catch {
    authConfig = undefined
  }

  // Resolve the effective permission for this operation.
  //  • restore → permissions.restore ?? softDelete.restore ?? permissions.update ?? 'admin'
  //  • purge   → permissions.purge   ?? softDelete.purge   ?? permissions.delete ?? 'admin'
  //    (destructive/recovery ops; org admins/custom roles enabled via explicit config above.)
  //  • create/read/update/delete: the configured permission, or undefined (= allowed; the
  //    request pipeline already ran the base authorize for these).
  let effectivePermission: string | string[] | PermissionFunction | PermissionObject | undefined
  if (operation === 'restore' || operation === 'purge') {
    const perms = authConfig?.permissions as any
    const sd = authConfig?.softDelete as any
    const firstClass = operation === 'restore' ? perms?.restore : perms?.purge
    const override = operation === 'restore' ? sd?.restore : sd?.purge
    const baseOp = operation === 'restore' ? 'update' : 'delete'
    if (firstClass !== undefined) effectivePermission = firstClass
    else if (override !== undefined) effectivePermission = override
    else if (perms?.[baseOp] !== undefined) effectivePermission = perms[baseOp]
    else effectivePermission = 'admin'
  }
  else {
    effectivePermission = authConfig?.permissions?.[operation]
  }

  // evaluatePermission(undefined) === true, so create/read/update/delete with no config are
  // allowed; restore/purge always carry a concrete permission (override/base/default 'admin').
  const allowed = await evaluatePermission(effectivePermission, context)

  if (!allowed) {
    throw createError({
      statusCode: context.user ? 403 : 401,
      message: context.user
        ? `Forbidden: You don't have permission to ${operation} ${resource}`
        : 'Authentication required',
    })
  }

  // Object-level check when a recordId is supplied.
  if (opts.recordId !== undefined && authConfig?.objectLevel) {
    const table = context.schema?.[resource]
    if (table) {
      const pid = /^\d+$/.test(String(opts.recordId)) ? Number(opts.recordId) : opts.recordId
      const [record] = await context.db?.select().from(table).where(eq(table.id, pid)) ?? []
      if (record) {
        const allowed = await authConfig.objectLevel(record, context)
        if (!allowed) {
          throw createError({ statusCode: 403, message: 'Forbidden: insufficient object-level permission' })
        }
      }
    }
  }
}
