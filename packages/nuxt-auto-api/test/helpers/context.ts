import type { HandlerContext, ResourceAuthConfig, ResourceRegistration } from '../../src/runtime/types'
import { getAuthConfig } from '../../src/runtime/server/utils/authConfig'

/** Every operation allowed — for tests about something other than authorization. */
export const OPEN: ResourceAuthConfig = {
  permissions: { read: true, create: true, update: true, delete: true, restore: true, purge: true, viewDeleted: true },
}

/**
 * A registry the way the module generates it: every table of `schema`, with `auth[name]` (default: OPEN
 * for every resource — pass `undefined` explicitly to test a resource that declares nothing).
 */
export function registryFor(
  schema: Record<string, any>,
  auth: Record<string, ResourceAuthConfig | undefined> = {},
  extra: Record<string, Partial<ResourceRegistration>> = {},
): Record<string, ResourceRegistration> {
  const out: Record<string, ResourceRegistration> = {}
  for (const [name, table] of Object.entries(schema)) {
    if (!table || typeof table !== 'object' || !(Symbol.for('drizzle:Name') in table)) continue
    out[name] = {
      name,
      schema: table,
      authorization: name in auth ? auth[name] : OPEN,
      ...extra[name],
    }
  }
  return out
}

/**
 * A HandlerContext as `createContextFromRegistry` builds it (minus the HTTP parts), for calling handlers
 * directly against a real database.
 */
export function makeContext(opts: {
  db: any
  schema: Record<string, any>
  resource: string
  operation?: HandlerContext['operation']
  auth?: Record<string, ResourceAuthConfig | undefined>
  extra?: Record<string, Partial<ResourceRegistration>>
  user?: any
  permissions?: string[]
  params?: Record<string, string>
  query?: Record<string, any>
  body?: any
  tenant?: HandlerContext['tenant']
  autoApi?: Record<string, any>
  event?: any
}): HandlerContext {
  const registry = registryFor(opts.schema, opts.auth, opts.extra)
  const schema: Record<string, any> = {}
  for (const [name, reg] of Object.entries(registry)) schema[name] = reg.schema

  const context: HandlerContext = {
    db: opts.db,
    adapter: {
      atomic: async (cb: any) => opts.db.transaction ? opts.db.transaction((tx: any) => cb({ tx })) : cb({ tx: opts.db }),
    } as any,
    schema,
    fullSchema: opts.db?._?.schema,
    user: opts.user ?? null,
    permissions: opts.permissions ?? opts.user?.permissions ?? [],
    params: opts.params ?? {},
    query: opts.query ?? {},
    validated: { query: opts.query ?? {}, body: opts.body },
    event: opts.event ?? { path: `/api/${opts.resource}`, method: 'GET', context: {} },
    runtimeConfig: { autoApi: opts.autoApi ?? {} },
    resource: opts.resource,
    operation: opts.operation ?? 'list',
    tenant: opts.tenant,
    resourceConfig: registry[opts.resource],
    registry,
  }
  context.effectiveAuth = getAuthConfig(context, opts.resource)
  context.objectLevelCheck = context.effectiveAuth?.objectLevel
  context.listFilter = context.effectiveAuth?.listFilter
  return context
}
