import type { HandlerContext, PermissionQueryResponse } from '../../types'
import { getResourcePermissions } from '../utils/permissions'

/**
 * Handler to get permission information for a resource
 */
export async function permissionsHandler(
  context: HandlerContext,
): Promise<PermissionQueryResponse> {
  const { registry } = await import('#nuxt-auto-api-registry')
  const resourceConfig = registry[context.resource]

  if (!resourceConfig) {
    throw new Error(`Resource "${context.resource}" not found`)
  }

  const permissions = await getResourcePermissions(
    resourceConfig.authorization,
    context,
  )

  return {
    ...permissions,
    resource: context.resource,
    user: context.user,
  }
}
