import type { H3Event } from 'h3'
import { getQuery, getRouterParam, createError } from 'h3'
import { extractTenantId } from '../../utils/tenant'
import { getDatabaseAdapter } from '../../database'
import { getMiddlewareForStage, getContextExtenders } from '../../plugins/pluginRegistry'
import type { HandlerContext, MultiTenancyConfig } from '../../../types'
import type { MiddlewareStage } from '../../../types/plugin'
import { useRuntimeConfig } from '#imports'

/**
 * Create handler context for M2M operations
 * Similar to createContextFromRegistry but adapted for M2M routes
 *
 * M2M route formats:
 * - GET /api/{resource}/:id/relations/:relation (list)
 * - POST /api/{resource}/:id/relations/:relation (sync)
 * - POST /api/{resource}/:id/relations/:relation/add (add)
 * - DELETE /api/{resource}/:id/relations/:relation/remove (remove)
 * - POST /api/{resource}/:id/relations/batch (batch)
 */
export async function createM2MContext(
  event: H3Event
): Promise<{ context: HandlerContext; runMiddleware: (stage: MiddlewareStage) => Promise<void> }> {
  // Import registry from virtual module (generated at build time)
  const { registry } = await import('#nuxt-auto-api-registry') as any

  // Extract resource and relation from route
  const path = event.path.split('?')[0]
  const pathParts = path.split('/').filter(Boolean)

  // Find 'relations' in path
  const relationsIndex = pathParts.indexOf('relations')
  if (relationsIndex === -1) {
    throw createError({
      statusCode: 400,
      message: 'Invalid M2M route format',
    })
  }

  // Resource is before 'relations'
  // Pattern: /api/{resource}/:id/relations/:relation
  // pathParts: ['api', '{resource}', ':id', 'relations', ':relation']
  const resourceName = pathParts[relationsIndex - 2]

  // Get resource config from registry
  const resourceConfig = registry[resourceName]
  if (!resourceConfig) {
    throw createError({
      statusCode: 404,
      message: `Resource "${resourceName}" not found in registry`,
    })
  }

  // Get database adapter and instance
  let adapter
  let db
  try {
    adapter = getDatabaseAdapter()
    db = adapter.db
  } catch {
    db = (globalThis as any).__autoApiDb
    if (!db) {
      throw new Error('Database not initialized. Make sure to set globalThis.__autoApiDb in a server plugin or call initializeDatabase()')
    }
  }

  // Get authenticated user from event context (set by auth plugin)
  const user = (event.context as any).user || null
  const permissions = (event.context as any).permissions || user?.permissions || []

  // Build schema object with ALL tables from registry
  const schema: Record<string, any> = {}
  for (const [name, config] of Object.entries(registry)) {
    schema[name] = config.schema
  }

  // Store the full DB schema (includes relations) for buildRelations to use
  const fullSchema = (db as any)._.schema || schema

  // Get route params
  const params: Record<string, string> = {}
  const id = getRouterParam(event, 'id')
  if (id) {
    params.id = id
  }

  const relation = getRouterParam(event, 'relation')
  if (relation) {
    params.relation = relation
  }

  // Parse query params
  const query = getQuery(event) as Record<string, any>

  // Extract tenant ID if multi-tenancy is enabled
  const runtimeConfig = useRuntimeConfig()
  const multiTenancyConfig = runtimeConfig.autoApi?.multiTenancy as MultiTenancyConfig | undefined
  let tenant = null

  if (multiTenancyConfig?.enabled) {
    const tenantId = await extractTenantId(event, user, multiTenancyConfig)

    // Check if tenant required
    if (multiTenancyConfig.requireTenant && !tenantId) {
      throw createError({ statusCode: 400, message: 'Tenant ID required' })
    }

    // Check cross-tenant access
    const canAccessAllTenants = multiTenancyConfig.allowCrossTenantAccess?.(user) || false

    if (tenantId) {
      tenant = {
        id: tenantId,
        field: multiTenancyConfig.tenantIdField || 'organizationId',
        canAccessAllTenants,
      }
    }
  }

  // Build context
  const context: HandlerContext = {
    db,
    adapter,
    schema,
    fullSchema,
    user,
    permissions,
    params,
    query,
    validated: {},
    event,
    resource: resourceName,
    operation: 'm2m',
    objectLevelCheck: resourceConfig.authorization?.objectLevel,
    tenant,
    resourceConfig,
    registry, // Add full registry for accessing all resource configs
  }

  // Run context extenders from plugins
  const extenders = getContextExtenders()
  for (const extender of extenders) {
    await extender(context)
  }

  // Create runMiddleware helper
  const runMiddleware = async (stage: MiddlewareStage) => {
    const middlewares = getMiddlewareForStage(stage, resourceName, 'm2m')
    for (const mw of middlewares) {
      await mw.handler(context)
    }
  }

  return { context, runMiddleware }
}
