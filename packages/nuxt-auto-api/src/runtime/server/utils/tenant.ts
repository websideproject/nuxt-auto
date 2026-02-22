import type { H3Event } from 'h3'
import { getQuery, getHeader } from 'h3'
import type { MultiTenancyConfig, AuthUser } from '../../types'
import { eq } from 'drizzle-orm'

/**
 * Extract tenant ID from request using config
 */
export async function extractTenantId(
  event: H3Event,
  user: AuthUser | null,
  config: MultiTenancyConfig
): Promise<string | number | null> {
  if (!config.enabled) return null

  // Use custom extractor if provided
  if (config.getTenantId) {
    return await config.getTenantId(event)
  }

  // Default: try to get from user context (better-auth style)
  if (user && 'organizationId' in user) {
    return (user as any).organizationId
  }

  // Try from header
  const headerTenant = getHeader(event, 'x-tenant-id')
  if (headerTenant) return headerTenant

  // Try from query
  const queryTenant = getQuery(event).tenantId
  if (queryTenant) return queryTenant as string

  return null
}

/**
 * Check if resource should be tenant-scoped
 */
export function isTenantScoped(
  resource: string,
  table: any,
  config: MultiTenancyConfig
): boolean {
  if (!config.enabled) return false

  // Check exclusions
  if (config.excludedResources?.includes(resource)) return false

  // Check inclusions
  if (Array.isArray(config.scopedResources)) {
    return config.scopedResources.includes(resource)
  }

  if (config.scopedResources === '*') {
    // Auto-detect by checking if table has tenant field
    const tenantField = config.tenantIdField || 'organizationId'
    return tenantField in table
  }

  return false
}

/**
 * Build tenant where clause
 */
export function buildTenantWhere(
  table: any,
  tenantId: string | number,
  tenantField: string = 'organizationId'
) {
  return eq(table[tenantField], tenantId)
}
