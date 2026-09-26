import { createError } from 'h3'
import { assertPermission, type PermissionOperation } from '../utils/permissions'
import type { HandlerContext, ResourceAuthConfig } from '../../types'

/** The permission key an operation is gated by. */
export function permissionKeyFor(operation: HandlerContext['operation']): PermissionOperation {
  switch (operation) {
    case 'list':
    case 'get':
    case 'm2m':
      return 'read'
    case 'aggregate':
      return 'aggregate'
    case 'create':
    case 'update':
    case 'delete':
      return operation
    default:
      return 'read'
  }
}

/**
 * Operation-level authorization for one resource. Deny by default: a resource that declares no
 * authorization, or no permission for this operation, refuses it (401 anonymous / 403 signed in).
 */
export function createAuthorizationMiddleware(config?: ResourceAuthConfig) {
  return async (context: HandlerContext) => {
    await assertPermission(permissionKeyFor(context.operation), config, context)

    if (config?.objectLevel) context.objectLevelCheck = config.objectLevel
    if (config?.listFilter) context.listFilter = config.listFilter
  }
}

/**
 * Object-level authorization for a row that was already fetched.
 */
export async function checkObjectLevelAuth(object: any, context: HandlerContext): Promise<void> {
  if (!context.objectLevelCheck) return
  if (!(await context.objectLevelCheck(object, context))) {
    throw createError({ statusCode: 403, message: 'Forbidden: you don\'t have permission to access this object' })
  }
}
