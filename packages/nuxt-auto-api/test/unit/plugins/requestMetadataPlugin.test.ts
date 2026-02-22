import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequestMetadataPlugin } from '../../../src/runtime/plugins/requestMetadataPlugin'
import type { HandlerContext } from '../../../src/runtime/types'
import type { PluginRuntimeContext } from '../../../src/runtime/types/plugin'

// Mock H3 event
const createMockEvent = (headers: Record<string, string> = {}) => ({
  node: {
    req: {
      headers,
      socket: {
        remoteAddress: '127.0.0.1'
      }
    }
  }
})

// Mock plugin runtime context
const createMockPluginContext = () => {
  const extendContextFn = vi.fn()
  const addGlobalHookFn = vi.fn()

  return {
    ctx: {
      extendContext: extendContextFn,
      addGlobalHook: addGlobalHookFn,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
    } as unknown as PluginRuntimeContext,
    extendContextFn,
    addGlobalHookFn,
  }
}

describe('requestMetadataPlugin', () => {
  describe('Context Enrichment', () => {
    it('should register context extender', async () => {
      const plugin = createRequestMetadataPlugin()
      const { ctx, extendContextFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      expect(extendContextFn).toHaveBeenCalledTimes(1)
      expect(extendContextFn).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should extract Cloudflare headers by default', async () => {
      const plugin = createRequestMetadataPlugin()
      const { ctx, extendContextFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      // Get the extender function
      const extender = extendContextFn.mock.calls[0][0]

      const mockContext = {
        event: createMockEvent({
          'cf-connecting-ip': '1.2.3.4',
          'cf-ipcountry': 'US',
          'cf-ipcity': 'San Francisco',
          'cf-ipregion': 'California',
          'cf-timezone': 'America/Los_Angeles',
          'cf-iplatitude': '37.7749',
          'cf-iplongitude': '-122.4194',
          'user-agent': 'Mozilla/5.0',
        })
      } as unknown as HandlerContext

      await extender(mockContext)

      expect(mockContext.requestMeta).toEqual({
        ip: '1.2.3.4',
        country: 'US',
        city: 'San Francisco',
        region: 'California',
        timezone: 'America/Los_Angeles',
        latitude: '37.7749',
        longitude: '-122.4194',
        userAgent: 'Mozilla/5.0',
      })
    })

    it('should fallback to X-Forwarded-For when CF headers missing', async () => {
      const plugin = createRequestMetadataPlugin()
      const { ctx, extendContextFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const extender = extendContextFn.mock.calls[0][0]

      const mockContext = {
        event: createMockEvent({
          'x-forwarded-for': '5.6.7.8, 1.1.1.1',
          'user-agent': 'Mozilla/5.0',
        })
      } as unknown as HandlerContext

      await extender(mockContext)

      expect(mockContext.requestMeta?.ip).toBe('5.6.7.8')
    })

    it('should use custom extract function', async () => {
      const customExtract = vi.fn().mockResolvedValue({
        ip: '5.6.7.8',
        customField: 'custom',
      })

      const plugin = createRequestMetadataPlugin({ extract: customExtract })
      const { ctx, extendContextFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const extender = extendContextFn.mock.calls[0][0]
      const mockContext = {
        event: createMockEvent()
      } as unknown as HandlerContext

      await extender(mockContext)

      expect(customExtract).toHaveBeenCalledWith(mockContext.event)
      expect(mockContext.requestMeta).toEqual({
        ip: '5.6.7.8',
        customField: 'custom',
      })
    })

    it('should handle extraction errors gracefully', async () => {
      const failingExtract = vi.fn().mockRejectedValue(new Error('Network error'))

      const plugin = createRequestMetadataPlugin({ extract: failingExtract })
      const { ctx, extendContextFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const extender = extendContextFn.mock.calls[0][0]
      const mockContext = {
        event: createMockEvent()
      } as unknown as HandlerContext

      await extender(mockContext)

      expect(ctx.logger?.warn).toHaveBeenCalledWith(
        'Failed to extract request metadata:',
        expect.any(Error)
      )
      expect(mockContext.requestMeta).toEqual({})
    })
  })

  describe('Auto-Population', () => {
    it('should NOT register hooks when autoPopulate is false', async () => {
      const plugin = createRequestMetadataPlugin({ autoPopulate: false })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      expect(addGlobalHookFn).not.toHaveBeenCalled()
    })

    it('should register beforeCreate hook by default', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { ip: 'signupIp' },
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      expect(addGlobalHookFn).toHaveBeenCalledWith(
        expect.objectContaining({ beforeCreate: expect.any(Function) })
      )
    })

    it('should inject metadata into matching columns', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { ip: 'signupIp', country: 'signupCountry' },
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: {
          users: { signupIp: {}, signupCountry: {}, email: {} }
        },
        requestMeta: { ip: '1.2.3.4', country: 'US' }
      } as unknown as HandlerContext

      const data = { email: 'user@example.com' }
      const result = await beforeCreate(data, mockContext)

      expect(result).toEqual({
        email: 'user@example.com',
        signupIp: '1.2.3.4',
        signupCountry: 'US',
      })
    })

    it('should skip columns that do not exist in schema', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { ip: 'signupIp', country: 'signupCountry' },
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: {
          users: { email: {} }  // No signupIp or signupCountry column
        },
        requestMeta: { ip: '1.2.3.4', country: 'US' }
      } as unknown as HandlerContext

      const data = { email: 'user@example.com' }
      const result = await beforeCreate(data, mockContext)

      // Should not add signupIp or signupCountry since columns don't exist
      expect(result).toEqual({ email: 'user@example.com' })
    })

    it('should not overwrite user-provided values', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { ip: 'signupIp' },
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: { users: { signupIp: {} } },
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = { signupIp: '9.9.9.9' }  // User explicitly set
      const result = await beforeCreate(data, mockContext)

      expect(result.signupIp).toBe('9.9.9.9')  // Keep user value
    })

    it('should filter by resources when specified', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { ip: 'signupIp' },
        resources: ['users'],  // Only users
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'orders',
        schema: { orders: { signupIp: {} } },
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = {}
      const result = await beforeCreate(data, mockContext)

      expect(result).toEqual({})  // Should not populate for orders
    })

    it('should populate on both create and update when configured', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { ip: 'lastIp' },
        autoPopulateOn: ['create', 'update'],
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]

      expect(hooks).toHaveProperty('beforeCreate')
      expect(hooks).toHaveProperty('beforeUpdate')
      expect(hooks.beforeCreate).toBeInstanceOf(Function)
      expect(hooks.beforeUpdate).toBeInstanceOf(Function)
    })
  })

  describe('JSON Field Storage', () => {
    it('should store metadata in JSON column with path', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { json: 'metadata', path: 'signup' }
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: { users: { metadata: {} } },
        requestMeta: { ip: '1.2.3.4', country: 'US' }
      } as unknown as HandlerContext

      const data = { email: 'user@example.com' }
      const result = await beforeCreate(data, mockContext)

      expect(result).toEqual({
        email: 'user@example.com',
        metadata: {
          signup: {
            ip: '1.2.3.4',
            country: 'US'
          }
        }
      })
    })

    it('should merge with existing JSON data when merge=true', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { json: 'metadata', path: 'signup', merge: true }
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: { users: { metadata: {} } },
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = {
        metadata: { existingField: 'value' }
      }
      const result = await beforeCreate(data, mockContext)

      expect(result.metadata).toEqual({
        existingField: 'value',  // Preserved
        signup: { ip: '1.2.3.4' }
      })
    })

    it('should overwrite JSON data when merge=false', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { json: 'metadata', path: 'signup', merge: false }
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: { users: { metadata: {} } },
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = {
        metadata: { existingField: 'value' }
      }
      const result = await beforeCreate(data, mockContext)

      expect(result.metadata).toEqual({
        signup: { ip: '1.2.3.4' }  // existingField removed
      })
    })

    it('should store at top level when no path specified', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { json: 'metadata' }
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: { users: { metadata: {} } },
        requestMeta: { ip: '1.2.3.4', country: 'US' }
      } as unknown as HandlerContext

      const data = {}
      const result = await beforeCreate(data, mockContext)

      expect(result.metadata).toEqual({
        ip: '1.2.3.4',
        country: 'US'
      })
    })

    it('should skip if JSON column does not exist in schema', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { json: 'metadata', path: 'signup' }
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        schema: { users: { email: {} } },  // No metadata column
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = { email: 'user@example.com' }
      const result = await beforeCreate(data, mockContext)

      expect(result).toEqual({ email: 'user@example.com' })  // No metadata added
    })
  })

  describe('Custom Mapper Function', () => {
    it('should call custom mapper with metadata, data, and context', async () => {
      const customMapper = vi.fn((metadata, data, _context) => {
        data.custom = `${metadata.ip}_${_context.resource}`
        return data
      })

      const plugin = createRequestMetadataPlugin({
        autoPopulate: customMapper
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = { email: 'user@example.com' }
      const result = await beforeCreate(data, mockContext)

      expect(customMapper).toHaveBeenCalledWith(
        { ip: '1.2.3.4' },
        expect.objectContaining({ email: 'user@example.com' }),
        mockContext
      )
      expect(result.custom).toBe('1.2.3.4_users')
      expect(result.email).toBe('user@example.com')
    })

    it('should support async mapper functions', async () => {
      const asyncMapper = async (metadata: any, data: any, _context: any) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        data.asyncField = metadata.ip
        return data
      }

      const plugin = createRequestMetadataPlugin({
        autoPopulate: asyncMapper
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = {}
      const result = await beforeCreate(data, mockContext)

      expect(result.asyncField).toBe('1.2.3.4')
    })

    it('should allow mapper to compute derived fields', async () => {
      const mapper = (metadata: any, data: any) => {
        data.isDomestic = metadata.country === 'US'
        data.location = `${metadata.city}, ${metadata.country}`
        return data
      }

      const plugin = createRequestMetadataPlugin({
        autoPopulate: mapper
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeCreate = hooks.beforeCreate

      const mockContext = {
        resource: 'users',
        requestMeta: { country: 'US', city: 'San Francisco' }
      } as unknown as HandlerContext

      const data = {}
      const result = await beforeCreate(data, mockContext)

      expect(result).toEqual({
        isDomestic: true,
        location: 'San Francisco, US'
      })
    })
  })

  describe('beforeUpdate hook', () => {
    it('should pass correct parameters to populateData in beforeUpdate', async () => {
      const plugin = createRequestMetadataPlugin({
        autoPopulate: { ip: 'lastIp' },
        autoPopulateOn: ['update'],
      })
      const { ctx, addGlobalHookFn } = createMockPluginContext()

      await plugin.runtimeSetup!(ctx)

      const hooks = addGlobalHookFn.mock.calls[0][0]
      const beforeUpdate = hooks.beforeUpdate

      const mockContext = {
        resource: 'users',
        schema: { users: { lastIp: {} } },
        requestMeta: { ip: '1.2.3.4' }
      } as unknown as HandlerContext

      const data = { email: 'updated@example.com' }
      const result = await beforeUpdate(123, data, mockContext)

      expect(result).toEqual({
        email: 'updated@example.com',
        lastIp: '1.2.3.4',
      })
    })
  })
})
