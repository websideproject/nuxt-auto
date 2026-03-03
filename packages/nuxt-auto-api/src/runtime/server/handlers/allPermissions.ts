import type { H3Event } from 'h3'
import { getResourcePermissions } from '../utils/permissions'

/**
 * Handler to get permission information for ALL resources
 * More efficient than querying each resource individually
 */
export async function allPermissionsHandler(event: H3Event) {
  const { getAllResources } = await import('#nuxt-auto-api-registry')
  const resources = getAllResources()

  const allPermissions: Record<string, any> = {}

  // Get permissions for each resource
  for (const resource of resources) {
    // Create a minimal context for permission checking
    const context = {
      user: event.context.user || null,
      permissions: event.context.permissions || [],
      resource: resource.name,
      operation: 'list' as const,
      params: {},
      query: {},
      validated: {},
      event,
      db: null, // Not needed for basic permission checks
      schema: null, // Not needed for basic permission checks
    }

    try {
      const permissions = await getResourcePermissions(
        resource.authorization,
        context as any,
      )

      allPermissions[resource.name] = permissions
    }
    catch (error) {
      // If permission check fails, default to no access
      allPermissions[resource.name] = {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      }
    }
  }

  return {
    user: event.context.user || null,
    permissions: allPermissions,
  }
}
