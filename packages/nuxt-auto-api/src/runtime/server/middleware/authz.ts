import { createError } from 'h3'
import type { HandlerContext, ResourceAuthConfig } from '../../types'

/**
 * Check if user has required permissions
 */
function hasPermission(
  userPermissions: string[],
  required: string | string[] | Function,
  context: HandlerContext
): boolean {
  // If required is a function, call it
  if (typeof required === 'function') {
    return required(context)
  }

  // If required is a string, check if user has it
  if (typeof required === 'string') {
    return userPermissions.includes(required)
  }

  // If required is an array, check if user has any of them
  if (Array.isArray(required)) {
    return required.some(perm => userPermissions.includes(perm))
  }

  return false
}

/**
 * Authorization middleware factory
 * Creates an authorization function for a specific resource
 */
export function createAuthorizationMiddleware(config?: ResourceAuthConfig) {
  return async (context: HandlerContext) => {
    const { operation, user, permissions } = context

    // If no config, allow all operations
    if (!config) {
      return
    }

    // Map operation to permission key ('list' -> 'read', 'get' -> 'read')
    const permissionKey = operation === 'list' || operation === 'get' ? 'read' : operation

    // Get required permissions for this operation
    let requiredPermission = config.permissions?.[permissionKey as keyof typeof config.permissions]

    // If no permission required, allow
    if (!requiredPermission) {
      return
    }

    // Check if user has required permission
    if (!hasPermission(permissions, requiredPermission, context)) {
      throw createError({
        statusCode: user ? 403 : 401,
        message: user
          ? `Forbidden: You don't have permission to ${operation} this resource`
          : 'Authentication required',
      })
    }

    // Set object-level check for get/list/update/delete
    if (config.objectLevel && (operation === 'get' || operation === 'list' || operation === 'update' || operation === 'delete')) {
      context.objectLevelCheck = config.objectLevel
    }

    // Set SQL-level list filter (more efficient than objectLevel for list)
    if (config.listFilter && operation === 'list') {
      context.listFilter = config.listFilter
    }
  }
}

/**
 * Check object-level authorization
 * Call this after fetching an object
 */
export async function checkObjectLevelAuth(
  object: any,
  context: HandlerContext
): Promise<void> {
  if (!context.objectLevelCheck) {
    return
  }

  const allowed = await context.objectLevelCheck(object, context)

  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Forbidden: You don\'t have permission to access this object',
    })
  }
}

/**
 * Filter fields based on permissions
 */
export function filterFieldsByPermission(
  data: any,
  config?: ResourceAuthConfig,
  context?: HandlerContext
): any {
  if (!config?.fields || !context) {
    return data
  }

  const filtered: any = {}
  const userPermissions = context.permissions

  for (const [field, value] of Object.entries(data)) {
    const fieldConfig = config.fields[field]

    if (!fieldConfig) {
      // No restrictions on this field
      filtered[field] = value
      continue
    }

    // Check read permission
    if (fieldConfig.read) {
      if (hasPermission(userPermissions, fieldConfig.read, context)) {
        filtered[field] = value
      }
      // Field is excluded if user doesn't have read permission
    } else {
      // No read restriction
      filtered[field] = value
    }
  }

  return filtered
}

/**
 * Default authorization middleware
 * Can be overridden with custom logic
 */
export async function defaultAuthorize(context: HandlerContext): Promise<void> {
  // Get authorization config from runtime config
  // This would be set in the module configuration
  const config = (globalThis as any).__autoApiAuthConfig?.[context.resource]

  if (config) {
    const authz = createAuthorizationMiddleware(config)
    await authz(context)
  }
}
