import type {
  ResourceAuthConfig,
  HandlerContext,
  PermissionCheckResult,
  PermissionFunction,
} from '../../types'

/**
 * Check if a permission string/function evaluates to true
 */
async function evaluatePermission(
  permission: string | string[] | PermissionFunction | undefined,
  context: HandlerContext,
): Promise<boolean> {
  if (!permission) {
    return true // No permission required = allowed
  }

  // Function-based permission
  if (typeof permission === 'function') {
    return await permission(context)
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
