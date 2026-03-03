import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractTenantId, isTenantScoped, buildTenantWhere } from '../../../src/runtime/server/utils/tenant'
import type { H3Event } from 'h3'
import type { MultiTenancyConfig, AuthUser } from '../../../src/runtime/types'
import { eq } from 'drizzle-orm'
import { getQuery, getHeader } from 'h3'

// Mock h3 globally
vi.mock('h3', () => ({
  getQuery: vi.fn(() => ({})),
  getHeader: vi.fn(() => null),
}))

describe('tenant utilities', () => {
  describe('extractTenantId', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.mocked(getQuery).mockReturnValue({})
      vi.mocked(getHeader).mockReturnValue(null)
    })

    const createMockEvent = (overrides = {}): H3Event => ({
      node: {
        req: {
          headers: {},
        },
      },
      ...overrides,
    } as any)

    const baseConfig: MultiTenancyConfig = {
      enabled: true,
    }

    it('should return null when multi-tenancy is disabled', async () => {
      const event = createMockEvent()
      const config = { enabled: false }

      const tenantId = await extractTenantId(event, null, config)
      expect(tenantId).toBeNull()
    })

    it('should use custom getTenantId function', async () => {
      const event = createMockEvent()
      const config: MultiTenancyConfig = {
        enabled: true,
        getTenantId: async () => 'custom-tenant-123',
      }

      const tenantId = await extractTenantId(event, null, config)
      expect(tenantId).toBe('custom-tenant-123')
    })

    it('should extract from user organizationId', async () => {
      const event = createMockEvent()
      const user: AuthUser = {
        id: 1,
        organizationId: 42,
      } as any

      const tenantId = await extractTenantId(event, user, baseConfig)
      expect(tenantId).toBe(42)
    })

    it('should extract from x-tenant-id header', async () => {
      const event = createMockEvent({
        node: {
          req: {
            headers: {
              'x-tenant-id': 'tenant-from-header',
            },
          },
        },
      })

      vi.mocked(getHeader).mockReturnValue('tenant-from-header')

      const tenantId = await extractTenantId(event, null, baseConfig)
      expect(tenantId).toBe('tenant-from-header')
    })

    it('should extract from query parameter', async () => {
      const event = createMockEvent()
      vi.mocked(getQuery).mockReturnValue({ tenantId: 'tenant-from-query' })

      const tenantId = await extractTenantId(event, null, baseConfig)
      expect(tenantId).toBe('tenant-from-query')
    })

    it('should prioritize custom getTenantId over user', async () => {
      const event = createMockEvent()
      const user: AuthUser = {
        id: 1,
        organizationId: 99,
      } as any
      const config: MultiTenancyConfig = {
        enabled: true,
        getTenantId: async () => 'override-tenant',
      }

      const tenantId = await extractTenantId(event, user, config)
      expect(tenantId).toBe('override-tenant')
    })

    it('should return null when no tenant is found', async () => {
      const event = createMockEvent()

      const tenantId = await extractTenantId(event, null, baseConfig)
      expect(tenantId).toBeNull()
    })

    it('should handle async getTenantId', async () => {
      const event = createMockEvent()
      const config: MultiTenancyConfig = {
        enabled: true,
        getTenantId: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return 'async-tenant'
        },
      }

      const tenantId = await extractTenantId(event, null, config)
      expect(tenantId).toBe('async-tenant')
    })
  })

  describe('isTenantScoped', () => {
    // ... rest of the file ...
    const tableWithTenantField = {
      id: Symbol('id'),
      organizationId: Symbol('organizationId'),
      name: Symbol('name'),
    }

    const tableWithoutTenantField = {
      id: Symbol('id'),
      name: Symbol('name'),
    }

    const baseConfig: MultiTenancyConfig = {
      enabled: true,
    }

    it('should return false when multi-tenancy is disabled', () => {
      const config = { enabled: false }

      const result = isTenantScoped('posts', tableWithTenantField, config)
      expect(result).toBe(false)
    })

    it('should return false for excluded resource', () => {
      const config: MultiTenancyConfig = {
        enabled: true,
        excludedResources: ['tags', 'categories'],
      }

      const result = isTenantScoped('tags', tableWithTenantField, config)
      expect(result).toBe(false)
    })

    it('should return true for explicitly scoped resource', () => {
      const config: MultiTenancyConfig = {
        enabled: true,
        scopedResources: ['posts', 'comments'],
      }

      const result = isTenantScoped('posts', tableWithTenantField, config)
      expect(result).toBe(true)
    })

    it('should return false for resource not in scoped list', () => {
      const config: MultiTenancyConfig = {
        enabled: true,
        scopedResources: ['posts', 'comments'],
      }

      const result = isTenantScoped('users', tableWithTenantField, config)
      expect(result).toBe(false)
    })

    it('should auto-detect when scopedResources is "*"', () => {
      const config: MultiTenancyConfig = {
        enabled: true,
        scopedResources: '*',
      }

      const result1 = isTenantScoped('posts', tableWithTenantField, config)
      const result2 = isTenantScoped('users', tableWithoutTenantField, config)

      expect(result1).toBe(true)
      expect(result2).toBe(false)
    })

    it('should check for custom tenant field name', () => {
      const tableWithCustomField = {
        id: Symbol('id'),
        companyId: Symbol('companyId'),
      }

      const config: MultiTenancyConfig = {
        enabled: true,
        scopedResources: '*',
        tenantIdField: 'companyId',
      }

      const result = isTenantScoped('posts', tableWithCustomField, config)
      expect(result).toBe(true)
    })

    it('should prioritize excludedResources over scopedResources', () => {
      const config: MultiTenancyConfig = {
        enabled: true,
        scopedResources: ['posts', 'tags'],
        excludedResources: ['tags'],
      }

      const result = isTenantScoped('tags', tableWithTenantField, config)
      expect(result).toBe(false)
    })
  })

  describe('buildTenantWhere', () => {
    const mockTable = {
      id: Symbol('id'),
      organizationId: Symbol('organizationId'),
      companyId: Symbol('companyId'),
    }

    it('should build where clause with default field', () => {
      const result = buildTenantWhere(mockTable, 123)

      expect(result).toBeDefined()
      // The result should be an eq() condition
    })

    it('should build where clause with custom field', () => {
      const result = buildTenantWhere(mockTable, 456, 'companyId')

      expect(result).toBeDefined()
    })

    it('should handle string tenant IDs', () => {
      const result = buildTenantWhere(mockTable, 'org-uuid-123', 'organizationId')

      expect(result).toBeDefined()
    })

    it('should handle numeric tenant IDs', () => {
      const result = buildTenantWhere(mockTable, 999, 'organizationId')

      expect(result).toBeDefined()
    })

    it('should handle zero tenant ID', () => {
      const result = buildTenantWhere(mockTable, 0, 'organizationId')

      expect(result).toBeDefined()
    })
  })

  describe('integration scenarios', () => {
    it('should support subdomain-based tenancy', async () => {
      const event = createMockEvent({
        node: {
          req: {
            headers: {
              host: 'acme.example.com',
            },
          },
        },
      })

      const config: MultiTenancyConfig = {
        enabled: true,
        getTenantId: async (event) => {
          const host = event.node.req.headers.host as string
          const subdomain = host?.split('.')[0]
          return subdomain === 'acme' ? 'tenant-acme' : null
        },
      }

      const tenantId = await extractTenantId(event, null, config)
      expect(tenantId).toBe('tenant-acme')
    })

    it('should support multi-level tenant detection', async () => {
      const event = createMockEvent({
        node: {
          req: {
            headers: {
              'x-tenant-id': 'header-tenant',
            },
          },
        },
      })

      const user: AuthUser = {
        id: 1,
        organizationId: 42,
      } as any

      // Header should take precedence over user in default implementation
      const tenantId = await extractTenantId(event, user, {
        enabled: true,
      })

      // User organizationId takes precedence in default implementation
      expect(tenantId).toBe(42)
    })
  })
})

function createMockEvent(overrides = {}): H3Event {
  return {
    node: {
      req: {
        headers: {},
      },
    },
    ...overrides,
  } as any
}
