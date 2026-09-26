import { eq, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { HandlerContext, MultiTenancyConfig } from '../../types'
import { hasColumn } from './table'

/** The multi-tenancy config for this request (from `autoApi.multiTenancy`). */
export function getTenancyConfig(context: HandlerContext): MultiTenancyConfig | undefined {
  return (context.runtimeConfig as any)?.autoApi?.multiTenancy
}

/** Column (property key) that holds the tenant id on scoped tables. */
export function tenantField(config: MultiTenancyConfig | undefined): string {
  return config?.tenantIdField || 'organizationId'
}

/**
 * Whether `resource` is tenant-scoped: multi-tenancy is on, the resource is not excluded, it is listed in
 * `scopedResources` (or that is `'*'`, the default), and its table actually has the tenant column.
 */
export function isTenantScoped(resource: string, table: any, config: MultiTenancyConfig | undefined): boolean {
  if (!config?.enabled) return false
  if (config.excludedResources?.includes(resource)) return false
  if (!hasColumn(table, tenantField(config))) return false
  if (Array.isArray(config.scopedResources)) return config.scopedResources.includes(resource)
  return true
}

/**
 * The tenant of the request, from server-side state only — never from a header or query parameter:
 *
 *  1. `context.tenant` already set by a context extender (custom resolution, cross-tenant admins)
 *  2. `event.context.tenantId`, set by the app's own server middleware
 *  3. `ctx.user[userTenantField]` (default: the tenant column name, i.e. `user.organizationId`)
 */
export function resolveTenant(context: HandlerContext, config: MultiTenancyConfig | undefined): HandlerContext['tenant'] {
  if (context.tenant) return context.tenant
  if (!config?.enabled) return undefined

  const fromEvent = (context.event?.context as any)?.tenantId
  const fromUser = (context.user as any)?.[config.userTenantField || tenantField(config)]
  const id = fromEvent ?? fromUser
  if (id === undefined || id === null || id === '') return undefined
  return { id, field: tenantField(config), canAccessAllTenants: false }
}

const NO_ROWS = sql`1 = 0`

/**
 * The tenant condition every row of `resource` must satisfy for this caller, or `undefined` when the
 * resource is not tenant-scoped. A scoped resource with no active tenant matches **no rows** — tenancy
 * fails closed.
 *
 * A tenant set by an extender while `multiTenancy` is off (e.g. an organization API token) still scopes
 * every table that has its column.
 */
export function tenantCondition(context: HandlerContext, resource: string, table: any): SQL | undefined {
  const config = getTenancyConfig(context)
  const tenant = context.tenant

  if (config?.enabled) {
    if (!isTenantScoped(resource, table, config)) return undefined
    if (!tenant) return NO_ROWS
  }
  if (!tenant || tenant.canAccessAllTenants) return undefined
  if (!hasColumn(table, tenant.field)) return undefined
  return eq(table[tenant.field], tenant.id)
}

/** JS twin of `tenantCondition`, for rows that were already loaded (e.g. through `?include=`). */
export function rowInTenant(context: HandlerContext, resource: string, table: any, row: any): boolean {
  const config = getTenancyConfig(context)
  const tenant = context.tenant

  if (config?.enabled) {
    if (!isTenantScoped(resource, table, config)) return true
    if (!tenant) return false
  }
  if (!tenant || tenant.canAccessAllTenants) return true
  if (!hasColumn(table, tenant.field)) return true
  return row?.[tenant.field] != null && String(row[tenant.field]) === String(tenant.id)
}

/** The tenant column this resource must have stamped on writes, if any. */
export function tenantWriteField(context: HandlerContext, resource: string, table: any): string | undefined {
  const tenant = context.tenant
  const config = getTenancyConfig(context)
  if (config?.enabled && !isTenantScoped(resource, table, config)) return undefined
  if (!tenant) return undefined
  return hasColumn(table, tenant.field) ? tenant.field : undefined
}
