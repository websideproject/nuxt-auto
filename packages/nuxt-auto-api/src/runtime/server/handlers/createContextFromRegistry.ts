import type { H3Event } from 'h3'
import { getQuery, getRouterParam, createError } from 'h3'
import { createAuthorizationMiddleware } from '../middleware/authz'
import { createValidationMiddleware } from '../middleware/validate'
import { schemasFor } from '../validation/schemaGenerator'
import { getAuthConfig } from '../utils/authConfig'
import { getTenancyConfig, isTenantScoped, resolveTenant } from '../utils/tenant'
import { getDatabaseAdapter } from '../database'
import { getMiddlewareForStage, getContextExtenders } from '../plugins/pluginRegistry'
import type { HandlerContext, ResourceAuthConfig } from '../../types'
import type { MiddlewareStage } from '../../types/plugin'
import { useRuntimeConfig } from 'nitropack/runtime'

type Operation = HandlerContext['operation']

/**
 * Resource name of a generated route. Routes are `{prefix}/{resource}`, `/{resource}/:id`,
 * `/{resource}/{bulk|aggregate|permissions}`, `/{resource}/:id/restore` and
 * `/{resource}/:id/relations/...` — so the resource is the segment right after the prefix.
 */
export function resourceFromPath(event: H3Event, prefix: string): string | undefined {
  const path = event.path.split('?')[0] || ''
  const base = prefix.replace(/\/+$/, '')
  if (!path.startsWith(`${base}/`)) return undefined
  const segment = path.slice(base.length + 1).split('/')[0]
  return segment ? decodeURIComponent(segment) : undefined
}

/**
 * `?filter[status]=open&filter[views][$gt]=10` → `{ status: 'open', views: { $gt: '10' } }`.
 * A JSON `?filter=` wins when both are present.
 */
export function normalizeQuery(query: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  let bracketFilter: Record<string, any> | undefined
  for (const [key, value] of Object.entries(query)) {
    const m = /^filter((?:\[[^\]]*\])+)$/.exec(key)
    if (!m) {
      out[key] = value
      continue
    }
    const path = [...m[1]!.matchAll(/\[([^\]]*)\]/g)].map(x => x[1]!)
    bracketFilter ??= {}
    let node = bracketFilter
    for (let i = 0; i < path.length - 1; i++) node = (node[path[i]!] ??= {})
    node[path[path.length - 1]!] = value
  }
  if (bracketFilter && out.filter === undefined) out.filter = bracketFilter
  return out
}

function getDb(): { db: any, adapter: any } {
  try {
    const adapter = getDatabaseAdapter()
    return { db: adapter.db, adapter }
  }
  catch {
    const db = (globalThis as any).__autoApiDb
    if (!db) throw new Error('[nuxt-auto-api] Database not initialized — call initializeDatabase() in a server plugin')
    return { db, adapter: undefined }
  }
}

/**
 * A context for a request that is not about one resource (`/api/permissions`, M2M discovery, standalone
 * `createEndpoint`): database, caller (context extenders ran), registry and runtime config — no resource,
 * no tenant resolution.
 */
export async function createCallerContext(event: H3Event, operation: Operation = 'get'): Promise<HandlerContext> {
  const { registry } = await import('#nuxt-auto-api-registry') as any
  let db: any
  let adapter: any
  try {
    ({ db, adapter } = getDb())
  }
  catch {
    db = undefined
  }
  const user = (event.context as any).user || null
  const schema: Record<string, any> = {}
  for (const [name, config] of Object.entries(registry)) schema[name] = (config as any).schema

  const context: HandlerContext = {
    db,
    adapter,
    schema,
    user,
    permissions: (event.context as any).permissions || user?.permissions || [],
    params: { ...((event.context as any).params || {}) },
    query: normalizeQuery(getQuery(event) as Record<string, any>),
    validated: {},
    event,
    runtimeConfig: useRuntimeConfig(),
    resource: '',
    operation,
    registry,
  }
  for (const extender of getContextExtenders()) await extender(context)
  context.tenant = resolveTenant(context, getTenancyConfig(context))
  return context
}

/**
 * Build the request context for a generated (or `createEndpoint`) route: resolve the resource, the user
 * (context extenders), the tenant, and the effective authorization. Used by every entry point.
 */
export async function createContextFromRegistry(
  event: H3Event,
  operation: Operation,
  opts: { resource?: string } = {},
): Promise<{
  context: HandlerContext
  authorize: (ctx: HandlerContext) => Promise<void>
  validate: (ctx: HandlerContext) => Promise<void>
  runMiddleware: (stage: MiddlewareStage) => Promise<void>
  effectiveAuth: ResourceAuthConfig | undefined
}> {
  const { registry } = await import('#nuxt-auto-api-registry') as any
  const runtimeConfig = useRuntimeConfig()
  const prefix = (runtimeConfig as any).autoApi?.prefix || '/api'

  const resourceName = opts.resource
    ?? (event.context.params as any)?.__resource
    ?? resourceFromPath(event, prefix)
  const resourceConfig = resourceName ? registry[resourceName] : undefined
  if (!resourceName || !resourceConfig) {
    throw createError({ statusCode: 404, message: `Resource "${resourceName ?? ''}" not found` })
  }

  const { db, adapter } = getDb()

  const schema: Record<string, any> = {}
  for (const [name, config] of Object.entries(registry)) schema[name] = (config as any).schema

  const params: Record<string, string> = {}
  const id = getRouterParam(event, 'id')
  if (id !== undefined) params.id = id
  const relation = getRouterParam(event, 'relation')
  if (relation !== undefined) params.relation = relation

  const user = (event.context as any).user || null
  const context: HandlerContext = {
    db,
    adapter,
    schema,
    fullSchema: db?._?.schema || schema,
    user,
    permissions: (event.context as any).permissions || user?.permissions || [],
    params,
    query: normalizeQuery(getQuery(event) as Record<string, any>),
    validated: {},
    event,
    runtimeConfig,
    resource: resourceName,
    operation,
    tenant: undefined,
    resourceConfig,
    registry,
  }
  // Merged with the nuxt.config override (data only) — the single source for every gate in this request.
  context.effectiveAuth = getAuthConfig({ ...context, effectiveAuth: undefined })

  // Context extenders (better-auth, API tokens, …) may set user, permissions and tenant.
  for (const extender of getContextExtenders()) await extender(context)

  // Tenant AFTER the extenders, from server-side state only. A tenant-scoped resource without an active
  // tenant is refused outright (rows would be filtered to none anyway).
  const tenancy = getTenancyConfig(context)
  context.tenant = resolveTenant(context, tenancy)
  if (tenancy?.enabled && !context.tenant && isTenantScoped(resourceName, resourceConfig.schema, tenancy)) {
    throw createError({ statusCode: context.user ? 403 : 401, message: context.user ? 'An active tenant is required' : 'Authentication required' })
  }

  const effectiveAuth = context.effectiveAuth
  const authorize = createAuthorizationMiddleware(effectiveAuth)
  const validate = createValidationMiddleware(() => schemasFor(context, resourceName, resourceConfig))

  const runMiddleware = async (stage: MiddlewareStage) => {
    for (const mw of getMiddlewareForStage(stage, resourceName, operation)) await mw.handler(context)
  }

  return { context, authorize, validate, runMiddleware, effectiveAuth }
}
