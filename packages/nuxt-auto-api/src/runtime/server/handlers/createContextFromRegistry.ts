import type { H3Event } from 'h3'
import { getQuery, getRouterParam, createError } from 'h3'
import { createAuthorizationMiddleware, defaultAuthorize } from '../middleware/authz'
import { createValidationMiddleware, defaultValidate } from '../middleware/validate'
import { generateSchemas } from '../validation/schemaGenerator'
import { extractTenantId } from '../utils/tenant'
import { getDatabaseAdapter } from '../database'
import { getMiddlewareForStage, getContextExtenders } from '../plugins/pluginRegistry'
import type { HandlerContext, MultiTenancyConfig, ResourceAuthConfig } from '../../types'
import type { MiddlewareStage } from '../../types/plugin'
import { useRuntimeConfig } from '#imports'

function isPlainObject(v: any): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Merge one operation's permission value: string/array → override replaces (current behaviour);
 * object (descriptor) over object → deep-merge per key (a key set to `null` deletes it). This is
 * what lets an app override a structured permission *as data* through `autoApi.authorization`.
 */
function mergePermissionValue(base: any, override: any): any {
  if (override === undefined) return base
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, any> = { ...base }
    for (const [k, v] of Object.entries(override)) {
      if (v === null) delete out[k]
      else out[k] = v
    }
    return out
  }
  return override
}

function mergePermissionMap(base: Record<string, any> | undefined, override: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!override) return base
  const out: Record<string, any> = { ...base }
  for (const [op, val] of Object.entries(override)) {
    out[op] = mergePermissionValue(base?.[op], val)
  }
  return out
}

/**
 * Merge a nuxt.config authorization override into the module's ResourceAuthConfig.
 * Per-op: string/array values replace; object (descriptor) values deep-merge (so apps can override
 * a structured permission as data — `null` clears a key). objectLevel/listFilter are functions and
 * are always kept from the build-time module import.
 */
function mergeAuthConfig(
  base: ResourceAuthConfig | undefined,
  override: Record<string, any> | undefined,
): ResourceAuthConfig | undefined {
  if (!override) return base
  if (!base) return override as ResourceAuthConfig

  const merged: ResourceAuthConfig = { ...base }

  if (override.permissions) {
    merged.permissions = mergePermissionMap(base.permissions as any, override.permissions) as any
  }

  if (override.custom) {
    merged.custom = { ...base.custom }
    for (const [name, cfg] of Object.entries(override.custom as Record<string, any>)) {
      merged.custom[name] = {
        permissions: mergePermissionMap(base.custom?.[name]?.permissions as any, (cfg as any)?.permissions) as any,
      }
    }
  }

  // objectLevel and listFilter are functions — cannot come from runtimeConfig JSON
  merged.objectLevel = base.objectLevel
  merged.listFilter = base.listFilter

  return merged
}

/**
 * Create handler context from virtual module registry
 * This utility is used by all entry point handlers
 */
export async function createContextFromRegistry(
  event: H3Event,
  operation: 'list' | 'get' | 'create' | 'update' | 'delete' | 'bulk' | 'aggregate',
): Promise<{
  context: HandlerContext
  authorize: (ctx: HandlerContext) => Promise<void>
  validate: (ctx: HandlerContext) => Promise<void>
  runMiddleware: (stage: MiddlewareStage) => Promise<void>
  effectiveAuth: ResourceAuthConfig | undefined
}> {
  // Import registry from virtual module (generated at build time)
  const { registry } = await import('#nuxt-auto-api-registry') as any

  // Extract resource name from route
  // Priority: 1. Explicit __resource param (from createEndpoint)
  //           2. Parse from URL path
  let resourceName = (event.context.params as any)?.__resource

  if (!resourceName) {
    // Route formats:
    // - /api/{resource} (list, create)
    // - /api/{resource}/:id (get, update, delete)
    // - /api/{resource}/bulk (bulk operations)
    // - /api/{resource}/aggregate (aggregations)
    const path = event.path.split('?')[0]
    const pathParts = path.split('/').filter(Boolean)

    // For routes with :id, resource is second-to-last part
    // For routes with /bulk or /aggregate suffix, resource is second-to-last part
    // For routes without :id, resource is last part
    const hasId = getRouterParam(event, 'id') !== undefined
    const lastPart = pathParts[pathParts.length - 1]
    const hasOperationSuffix = lastPart === 'bulk' || lastPart === 'aggregate' || lastPart === 'permissions'

    resourceName = hasId || hasOperationSuffix
      ? pathParts[pathParts.length - 2]
      : pathParts[pathParts.length - 1]
  }

  // Get resource config from registry
  const resourceConfig = registry[resourceName]
  if (!resourceConfig) {
    throw new Error(`Resource "${resourceName}" not found in registry`)
  }

  // Get database adapter and instance
  let adapter
  let db
  try {
    adapter = getDatabaseAdapter()
    db = adapter.db
  }
  catch {
    // Fallback to legacy globalThis.__autoApiDb
    db = (globalThis as any).__autoApiDb
    if (!db) {
      throw new Error('Database not initialized. Make sure to set globalThis.__autoApiDb in a server plugin or call initializeDatabase()')
    }
  }

  // Get authenticated user from event context (set by auth plugin)
  const user = (event.context as any).user || null
  const permissions = (event.context as any).permissions || user?.permissions || []

  // Build schema object with ALL tables from registry
  // For relational queries, we also need the full schema from DB (which includes relations)
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

  // Parse query params
  const query = getQuery(event) as Record<string, any>
  // Note: filter parsing is now handled by validation schema

  // Merge nuxt.config authorization override (strings/arrays only) with module defaults.
  // Functions in objectLevel/listFilter always come from the build-time import.
  const runtimeConfig = useRuntimeConfig()
  const authOverride = (runtimeConfig.autoApi?.authorization as any)?.[resourceName]
  const effectiveAuth = mergeAuthConfig(resourceConfig.authorization, authOverride)

  // Build context (tenant starts as null — populated after context extenders)
  const context: HandlerContext = {
    db,
    adapter,
    schema,
    fullSchema, // Full schema with relations for relational queries
    user,
    permissions,
    params,
    query,
    validated: {},
    event,
    resource: resourceName,
    operation,
    objectLevelCheck: effectiveAuth?.objectLevel,
    tenant: null,
    resourceConfig,
    registry, // Add full registry for accessing all resource configs
  }

  // Create authorization middleware using effective (merged) auth
  const authorize = effectiveAuth
    ? createAuthorizationMiddleware(effectiveAuth)
    : defaultAuthorize

  // Create validation middleware
  let validate = defaultValidate
  if (resourceConfig.validation) {
    validate = createValidationMiddleware(resourceConfig.validation)
  }
  else if (resourceConfig.schema) {
    try {
      const schemas = generateSchemas(resourceConfig.schema)
      validate = createValidationMiddleware(schemas)
    }
    catch (error) {
      console.warn(`[nuxt-auto-api] Failed to generate validation schemas for ${resourceName}`, error)
    }
  }

  // Run context extenders from plugins (e.g. Better Auth, API token auth)
  // These may populate context.user, context.permissions, and context.tenant
  const extenders = getContextExtenders()
  for (const extender of extenders) {
    await extender(context)
  }

  // Extract tenant AFTER context extenders so token/session auth can set user first.
  // Skip if an extender already set context.tenant directly (e.g. org tokens).
  const multiTenancyConfig = runtimeConfig.autoApi?.multiTenancy as MultiTenancyConfig | undefined

  if (multiTenancyConfig?.enabled && !context.tenant) {
    const tenantId = await extractTenantId(event, context.user, multiTenancyConfig)

    // Check if tenant required
    if (multiTenancyConfig.requireTenant && !tenantId) {
      throw createError({ statusCode: 400, message: 'Tenant ID required' })
    }

    // Check cross-tenant access
    const canAccessAllTenants = multiTenancyConfig.allowCrossTenantAccess?.(context.user) || false

    if (tenantId) {
      context.tenant = {
        id: tenantId,
        field: multiTenancyConfig.tenantIdField || 'organizationId',
        canAccessAllTenants,
      }
    }
  }

  // Create runMiddleware helper
  const runMiddleware = async (stage: MiddlewareStage) => {
    const middlewares = getMiddlewareForStage(stage, resourceName, operation)
    for (const mw of middlewares) {
      await mw.handler(context)
    }
  }

  return { context, authorize, validate, runMiddleware, effectiveAuth }
}
