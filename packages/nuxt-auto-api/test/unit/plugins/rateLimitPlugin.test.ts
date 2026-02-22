import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRateLimitPlugin } from '../../../src/runtime/plugins/rateLimitPlugin'

// Mock h3
vi.mock('h3', () => ({
  createError: (opts: any) => {
    const error = new Error(opts.message) as any
    error.statusCode = opts.statusCode
    error.statusMessage = opts.statusMessage
    return error
  },
}))

describe('createRateLimitPlugin', () => {
  it('should create a plugin with correct name', () => {
    const plugin = createRateLimitPlugin()
    expect(plugin.name).toBe('rate-limit')
    expect(plugin.version).toBe('1.0.0')
  })

  it('should have runtimeSetup function', () => {
    const plugin = createRateLimitPlugin()
    expect(typeof plugin.runtimeSetup).toBe('function')
  })

  describe('runtime behavior', () => {
    let registeredMiddleware: any = null

    const mockRuntimeContext = {
      addMiddleware: vi.fn((mw: any) => { registeredMiddleware = mw }),
      addContextExtender: vi.fn(),
      addHook: vi.fn(),
      addGlobalHook: vi.fn(),
      extendContext: vi.fn(),
      runtimeConfig: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }

    beforeEach(() => {
      vi.clearAllMocks()
      registeredMiddleware = null
    })

    it('should register pre-auth middleware', async () => {
      const plugin = createRateLimitPlugin({ max: 5, windowMs: 1000 })
      await plugin.runtimeSetup!(mockRuntimeContext as any)

      expect(mockRuntimeContext.addMiddleware).toHaveBeenCalledTimes(1)
      expect(registeredMiddleware.stage).toBe('pre-auth')
      expect(registeredMiddleware.order).toBe(-100)
      expect(registeredMiddleware.name).toBe('rate-limit')
    })

    it('should allow requests within limit', async () => {
      const plugin = createRateLimitPlugin({ max: 3, windowMs: 10000 })
      await plugin.runtimeSetup!(mockRuntimeContext as any)

      const mockEvent = {
        node: {
          req: { headers: { 'x-forwarded-for': '1.2.3.4' }, socket: {} },
          res: { setHeader: vi.fn() },
        },
      }

      const context = {
        event: mockEvent,
        user: null,
      } as any

      // First 3 requests should be fine
      await registeredMiddleware.handler(context)
      await registeredMiddleware.handler(context)
      await registeredMiddleware.handler(context)

      // No error thrown
      expect(mockEvent.node.res.setHeader).toHaveBeenCalled()
    })

    it('should block requests exceeding limit', async () => {
      const plugin = createRateLimitPlugin({ max: 2, windowMs: 10000 })
      await plugin.runtimeSetup!(mockRuntimeContext as any)

      const mockEvent = {
        node: {
          req: { headers: { 'x-forwarded-for': '5.6.7.8' }, socket: {} },
          res: { setHeader: vi.fn() },
        },
      }

      const context = { event: mockEvent, user: null } as any

      await registeredMiddleware.handler(context)
      await registeredMiddleware.handler(context)

      // Third request should throw 429
      await expect(registeredMiddleware.handler(context)).rejects.toThrow(
        'Too many requests, please try again later'
      )
    })

    it('should skip when skip function returns true', async () => {
      const plugin = createRateLimitPlugin({
        max: 1,
        windowMs: 10000,
        skip: (ctx: any) => ctx.user?.role === 'admin',
      })
      await plugin.runtimeSetup!(mockRuntimeContext as any)

      const context = {
        event: { node: { req: { headers: {}, socket: { remoteAddress: '9.9.9.9' } }, res: { setHeader: vi.fn() } } },
        user: { role: 'admin' },
      } as any

      // Should not throw even with max: 1 since skip returns true
      await registeredMiddleware.handler(context)
      await registeredMiddleware.handler(context)
      await registeredMiddleware.handler(context)
    })

    it('should use custom key generator', async () => {
      const plugin = createRateLimitPlugin({
        max: 1,
        windowMs: 10000,
        keyGenerator: (ctx: any) => `api-key:${ctx.user?.apiKey}`,
      })
      await plugin.runtimeSetup!(mockRuntimeContext as any)

      const context1 = {
        event: { node: { req: { headers: {} }, res: { setHeader: vi.fn() } } },
        user: { apiKey: 'key-a' },
      } as any

      const context2 = {
        event: { node: { req: { headers: {} }, res: { setHeader: vi.fn() } } },
        user: { apiKey: 'key-b' },
      } as any

      // Different keys should have separate counters
      await registeredMiddleware.handler(context1)
      await registeredMiddleware.handler(context2)

      // Both should succeed since they're separate keys
    })

    it('should set rate limit headers', async () => {
      const plugin = createRateLimitPlugin({ max: 10, windowMs: 60000 })
      await plugin.runtimeSetup!(mockRuntimeContext as any)

      const setHeader = vi.fn()
      const context = {
        event: {
          node: {
            req: { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} },
            res: { setHeader },
          },
        },
        user: null,
      } as any

      await registeredMiddleware.handler(context)

      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9')
      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
    })

    it('should use custom error message', async () => {
      const plugin = createRateLimitPlugin({
        max: 1,
        windowMs: 10000,
        message: 'Slow down!',
      })
      await plugin.runtimeSetup!(mockRuntimeContext as any)

      const context = {
        event: {
          node: {
            req: { headers: { 'x-forwarded-for': '11.0.0.1' }, socket: {} },
            res: { setHeader: vi.fn() },
          },
        },
        user: null,
      } as any

      await registeredMiddleware.handler(context)
      await expect(registeredMiddleware.handler(context)).rejects.toThrow('Slow down!')
    })
  })
})
