import { describe, it, expect } from 'vitest'
import { sqliteTable, text, integer, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import type { HandlerContext, MultiTenancyConfig } from '../../../src/runtime/types'
import { isTenantScoped, resolveTenant, tenantCondition, rowInTenant, tenantWriteField } from '../../../src/runtime/server/utils/tenant'

const posts = sqliteTable('posts', { id: integer('id').primaryKey(), organizationId: text('organization_id') })
const workspaces = sqliteTable('ws', { id: integer('id').primaryKey(), workspaceId: text('workspace_id') })
const tags = sqliteTable('tags', { id: integer('id').primaryKey(), name: text('name') })
const dialect = new SQLiteSyncDialect()
const render = (s: any) => s && dialect.sqlToQuery(s)

function ctx(over: Partial<HandlerContext> & { multiTenancy?: MultiTenancyConfig, eventContext?: any } = {}): HandlerContext {
  return {
    db: null, schema: {}, user: null, permissions: [], params: {}, query: {}, validated: {},
    event: { context: over.eventContext ?? {}, headers: {} } as any,
    resource: 'posts', operation: 'list',
    runtimeConfig: { autoApi: { multiTenancy: over.multiTenancy } },
    ...over,
  } as HandlerContext
}

describe('tenant', () => {
  describe('isTenantScoped', () => {
    const on: MultiTenancyConfig = { enabled: true }
    it('is false when multi-tenancy is off', () => expect(isTenantScoped('posts', posts, { enabled: false })).toBe(false))
    it('defaults to every table that has the tenant column', () => {
      expect(isTenantScoped('posts', posts, on)).toBe(true)
      expect(isTenantScoped('tags', tags, on)).toBe(false)
    })
    it('honours scopedResources and excludedResources (exclusion wins)', () => {
      expect(isTenantScoped('posts', posts, { enabled: true, scopedResources: ['other'] })).toBe(false)
      expect(isTenantScoped('posts', posts, { enabled: true, scopedResources: ['posts'], excludedResources: ['posts'] })).toBe(false)
    })
    it('uses a custom tenantIdField', () => {
      expect(isTenantScoped('ws', workspaces, { enabled: true, tenantIdField: 'workspaceId' })).toBe(true)
      expect(isTenantScoped('posts', posts, { enabled: true, tenantIdField: 'workspaceId' })).toBe(false)
    })
  })

  describe('resolveTenant — server-side sources only', () => {
    const mt: MultiTenancyConfig = { enabled: true }
    it('reads the user tenant field', () => {
      expect(resolveTenant(ctx({ user: { id: 1, organizationId: 'o1' } }), mt)).toEqual({ id: 'o1', field: 'organizationId', canAccessAllTenants: false })
    })
    it('prefers event.context.tenantId (set by server middleware)', () => {
      expect(resolveTenant(ctx({ user: { id: 1, organizationId: 'o1' }, eventContext: { tenantId: 'o9' } }), mt)?.id).toBe('o9')
    })
    it('keeps a tenant an extender already set', () => {
      const tenant = { id: 'x', field: 'organizationId', canAccessAllTenants: true }
      expect(resolveTenant(ctx({ tenant }), mt)).toBe(tenant)
    })
    it('uses userTenantField', () => {
      expect(resolveTenant(ctx({ user: { id: 1, activeOrg: 'o3' } }), { enabled: true, userTenantField: 'activeOrg' })?.id).toBe('o3')
    })
    it('never reads a header or query parameter', () => {
      const c = ctx({ query: { tenantId: 'evil' } })
      ;(c.event as any).headers = { 'x-tenant-id': 'evil' }
      ;(c.event as any).node = { req: { headers: { 'x-tenant-id': 'evil' } } }
      expect(resolveTenant(c, mt)).toBeUndefined()
    })
    it('treats null / empty tenant ids as "no tenant"', () => {
      expect(resolveTenant(ctx({ user: { id: 1, organizationId: null } }), mt)).toBeUndefined()
      expect(resolveTenant(ctx({ user: { id: 1, organizationId: '' } }), mt)).toBeUndefined()
    })
  })

  describe('tenantCondition — fails closed', () => {
    const mt: MultiTenancyConfig = { enabled: true }
    const t = { id: 'o1', field: 'organizationId', canAccessAllTenants: false }

    it('scopes a scoped table to the tenant', () => {
      expect(render(tenantCondition(ctx({ multiTenancy: mt, tenant: t }), 'posts', posts))).toMatchObject({ sql: '"posts"."organization_id" = ?', params: ['o1'] })
    })
    it('matches NO rows on a scoped table when there is no tenant', () => {
      expect(render(tenantCondition(ctx({ multiTenancy: mt }), 'posts', posts))?.sql).toBe('1 = 0')
    })
    it('leaves unscoped tables and cross-tenant operators alone', () => {
      expect(tenantCondition(ctx({ multiTenancy: mt, tenant: t }), 'tags', tags)).toBeUndefined()
      expect(tenantCondition(ctx({ multiTenancy: mt, tenant: { ...t, canAccessAllTenants: true } }), 'posts', posts)).toBeUndefined()
    })
    it('still scopes when an extender set a tenant with multi-tenancy off (org API tokens)', () => {
      expect(render(tenantCondition(ctx({ tenant: t }), 'posts', posts))?.params).toEqual(['o1'])
    })
    it('rowInTenant mirrors it for loaded rows', () => {
      const c = ctx({ multiTenancy: mt, tenant: t })
      expect(rowInTenant(c, 'posts', posts, { organizationId: 'o1' })).toBe(true)
      expect(rowInTenant(c, 'posts', posts, { organizationId: 'o2' })).toBe(false)
      expect(rowInTenant(ctx({ multiTenancy: mt }), 'posts', posts, { organizationId: 'o1' })).toBe(false)
    })
    it('tenantWriteField names the column to stamp on scoped tables only', () => {
      expect(tenantWriteField(ctx({ multiTenancy: mt, tenant: t }), 'posts', posts)).toBe('organizationId')
      expect(tenantWriteField(ctx({ multiTenancy: mt, tenant: t }), 'tags', tags)).toBeUndefined()
    })
  })
})
