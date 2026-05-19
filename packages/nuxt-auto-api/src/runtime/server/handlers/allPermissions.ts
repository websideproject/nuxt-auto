import type { H3Event } from 'h3'
import { getResourcePermissions } from '../utils/permissions'
import { getContextExtenders } from '../plugins/pluginRegistry'
import type { HandlerContext } from '../../types'

/**
 * Handler to get permission information for ALL resources
 * More efficient than querying each resource individually
 */
export async function allPermissionsHandler(event: H3Event) {
  const { getAllResources } = await import('#nuxt-auto-api-registry')
  const resources = getAllResources()

  // Build a shared base context and run extendContext plugins once.
  // This mirrors what createContextFromRegistry does for per-resource endpoints,
  // ensuring requestMeta (orgRole, billing, etc.) is populated before any
  // permission check runs.
  const sharedContext: HandlerContext = {
    user: (event.context as any).user || null,
    permissions: (event.context as any).permissions || [],
    resource: '',
    operation: 'list' as const,
    params: {},
    query: {},
    validated: {},
    event,
    db: null as any,
    schema: null as any,
  }

  const extenders = getContextExtenders()
  for (const extender of extenders) {
    await extender(sharedContext)
  }

  const allPermissions: Record<string, any> = {}

  for (const resource of resources) {
    // Reuse the enriched shared context — swap only the resource name.
    const context = { ...sharedContext, resource: resource.name }

    try {
      const permissions = await getResourcePermissions(
        resource.authorization,
        context as any,
      )
      allPermissions[resource.name] = permissions
    }
    catch {
      allPermissions[resource.name] = {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      }
    }
  }

  return {
    user: sharedContext.user || null,
    permissions: allPermissions,
  }
}
