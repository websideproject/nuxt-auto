import { createError } from 'h3'
import { resolveObjectPermission } from './resolveObjectPermission'
import type { HandlerContext, ResourceAuthConfig } from '../../types'

/**
 * Check if user has required permissions.
 * Exported so createEndpoint can reuse the same resolution logic for custom endpoint gates.
 */
export async function hasPermission(
  userPermissions: string[],
  required: string | string[] | Function | Record<string, any>,
  context: HandlerContext,
): Promise<boolean> {
  // Wildcard — user has all permissions
  if (userPermissions.includes('*')) {
    return true
  }

  // If required is a function, call it (supports async permission functions)
  if (typeof required === 'function') {
    return await required(context)
  }

  // If required is a string, check if user has it
  if (typeof required === 'string') {
    return userPermissions.includes(required)
  }

  // If required is an array, check if user has any of them
  if (Array.isArray(required)) {
    return required.some(perm => userPermissions.includes(perm))
  }

  // Structured (object) permission → hand to registered evaluators (generic seam)
  if (required && typeof required === 'object') {
    return await resolveObjectPermission(required, context)
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
    const requiredPermission = config.permissions?.[permissionKey as keyof typeof config.permissions]

    // If no permission required, allow
    if (!requiredPermission) {
      return
    }

    // Check if user has required permission
    if (!await hasPermission(permissions, requiredPermission, context)) {
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
  context: HandlerContext,
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

// ⚠ `filterFieldsByPermission` used to live here. It implemented the read half of `fields[x]` and **no
// handler ever called it** — its only caller in the repo was its own unit test, which passed for as long
// as it existed while every restricted column was served to every reader. It has been deleted rather than
// wired up, because it is the reason nobody looked: a green test over an implementation that is not
// reachable reads exactly like a working feature.
//
// Enforcement now lives in `../utils/fieldPermissions.ts` and is called by create/update/get/list/bulk. It
// evaluates through `checkFieldPermission` rather than `hasPermission` below — see that file's header for
// why the `*` wildcard short-circuit is the wrong evaluator for a field gate.

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
