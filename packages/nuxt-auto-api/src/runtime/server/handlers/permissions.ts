import type { HandlerContext, PermissionQueryResponse } from '../../types'
import { getResourcePermissions } from '../utils/permissions'

/**
 * GET /api/{resource}/permissions — what the caller may do, evaluated exactly as the gates enforce it
 * (the merged nuxt.config override, deny by default).
 */
export async function permissionsHandler(context: HandlerContext): Promise<PermissionQueryResponse> {
  const permissions = await getResourcePermissions(context.effectiveAuth, context)
  return { ...permissions, resource: context.resource, user: context.user }
}
