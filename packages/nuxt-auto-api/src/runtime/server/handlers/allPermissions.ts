import type { H3Event } from 'h3'
import { getResourcePermissions } from '../utils/permissions'
import { getAuthConfig } from '../utils/authConfig'
import { contextFor } from '../utils/rowAccess'
import { createCallerContext } from './createContextFromRegistry'

/**
 * GET /api/permissions — what the caller may do on every resource, in one request.
 */
export async function allPermissionsHandler(event: H3Event) {
  const caller = await createCallerContext(event)
  const permissions: Record<string, any> = {}

  for (const resource of Object.keys(caller.registry ?? {})) {
    const context = contextFor({ ...caller, resource: '' }, resource)
    try {
      permissions[resource] = await getResourcePermissions(getAuthConfig(context, resource), context)
    }
    catch (error) {
      console.error(`[nuxt-auto-api] permission check failed for "${resource}":`, error)
      permissions[resource] = { canCreate: false, canRead: false, canUpdate: false, canDelete: false, canRestore: false, canPurge: false, canViewDeleted: false }
    }
  }
  return { user: caller.user || null, permissions }
}
