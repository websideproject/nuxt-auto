import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockContext, mockAuthorize, mockValidate, mockRunMiddleware } = vi.hoisted(() => ({
  mockContext: {
    db: {},
    schema: {},
    user: { id: 1 },
    permissions: ['user'],
    params: { id: '1' },
    query: {},
    validated: {},
    event: {} as any,
    resource: 'users',
    operation: 'get' as const,
  },
  mockAuthorize: vi.fn(),
  mockValidate: vi.fn(),
  mockRunMiddleware: vi.fn(),
}))

// Mock h3
vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  readBody: vi.fn(async () => ({})),
  getQuery: vi.fn(() => ({})),
  createError: (opts: any) => {
    const error = new Error(opts.message) as any
    error.statusCode = opts.statusCode
    error.data = opts.data
    return error
  },
}))

// Mock createContextFromRegistry
vi.mock('../../../src/runtime/server/handlers/createContextFromRegistry', () => ({
  createContextFromRegistry: vi.fn().mockResolvedValue({
    context: mockContext,
    authorize: mockAuthorize,
    validate: mockValidate,
    runMiddleware: mockRunMiddleware,
  }),
}))

// Mock database
vi.mock('../../../src/runtime/server/database', () => ({
  getDatabaseAdapter: vi.fn(() => ({
    engine: 'better-sqlite3',
    db: {},
    atomic: vi.fn(),
    getMutationCount: vi.fn(),
    supportsReturning: true,
    supportsNativeBatch: false,
  })),
}))

// Mock plugin registry
vi.mock('../../../src/runtime/server/plugins/pluginRegistry', () => ({
  getContextExtenders: vi.fn(() => []),
  getMiddlewareForStage: vi.fn(() => []),
}))

// Mock serializeResponse
vi.mock('../../../src/runtime/server/utils/serializeResponse', () => ({
  serializeResponse: vi.fn((data: any) => data),
}))

import { createEndpoint } from '../../../src/runtime/server/utils/createEndpoint'

describe('createEndpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunMiddleware.mockReset()
  })

  it('should create an event handler function', () => {
    const handler = createEndpoint({
      handler: async () => ({ result: 'test' }),
    })

    expect(typeof handler).toBe('function')
  })

  describe('resource-bound endpoint', () => {
    it('should use full pipeline when resource is specified', async () => {
      const handler = createEndpoint({
        resource: 'users',
        operation: 'get',
        handler: async (ctx) => ({ user: ctx.user }),
      })

      const mockEvent = { method: 'GET', path: '/api/users/1', context: {} } as any
      const result = await handler(mockEvent)

      expect(mockAuthorize).toHaveBeenCalledWith(mockContext)
      expect(mockValidate).toHaveBeenCalledWith(mockContext)
      expect(result).toEqual({ data: { user: { id: 1 } } })
    })

    it('should skip authorization when requested', async () => {
      const handler = createEndpoint({
        resource: 'users',
        skipAuthorization: true,
        handler: async () => ({ data: 'test' }),
      })

      await handler({ method: 'GET', path: '/api/users', context: {} } as any)

      expect(mockAuthorize).not.toHaveBeenCalled()
      expect(mockValidate).toHaveBeenCalled()
    })

    it('should skip validation when requested', async () => {
      const handler = createEndpoint({
        resource: 'users',
        skipValidation: true,
        handler: async () => ({ data: 'test' }),
      })

      await handler({ method: 'GET', path: '/api/users', context: {} } as any)

      expect(mockAuthorize).toHaveBeenCalled()
      expect(mockValidate).not.toHaveBeenCalled()
    })
  })

  describe('standalone endpoint', () => {
    it('should create lightweight context without resource', async () => {
      const handlerSpy = vi.fn().mockResolvedValue({ value: 42 })

      const handler = createEndpoint({
        handler: handlerSpy,
      })

      await handler({ method: 'GET', path: '/api/custom', context: {} } as any)

      expect(handlerSpy).toHaveBeenCalled()
      const ctx = handlerSpy.mock.calls[0][0]
      expect(ctx.resource).toBe('')
    })
  })

  describe('body validation', () => {
    it('should validate body with Zod schema', async () => {
      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ name: 'John' })

      const mockSchema = {
        safeParse: vi.fn().mockReturnValue({
          success: true,
          data: { name: 'John' },
        }),
      }

      const handlerSpy = vi.fn().mockResolvedValue({})
      const handler = createEndpoint({
        body: mockSchema as any,
        handler: handlerSpy,
      })

      await handler({ method: 'POST', path: '/api/custom', context: {} } as any)

      expect(mockSchema.safeParse).toHaveBeenCalledWith({ name: 'John' })
      expect(handlerSpy.mock.calls[0][0].body).toEqual({ name: 'John' })
    })

    it('should throw 400 on body validation failure', async () => {
      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ invalid: true })

      const mockSchema = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: { issues: [{ message: 'Name is required' }] },
        }),
      }

      const handler = createEndpoint({
        body: mockSchema as any,
        handler: async () => ({}),
      })

      await expect(
        handler({ method: 'POST', path: '/api/custom', context: {} } as any)
      ).rejects.toThrow('Body validation failed')
    })
  })

  describe('query validation', () => {
    it('should validate query with Zod schema', async () => {
      const { getQuery } = await import('h3')
      vi.mocked(getQuery).mockReturnValue({ page: '1' } as any)

      const mockSchema = {
        safeParse: vi.fn().mockReturnValue({
          success: true,
          data: { page: 1 },
        }),
      }

      const handlerSpy = vi.fn().mockResolvedValue({})
      const handler = createEndpoint({
        query: mockSchema as any,
        handler: handlerSpy,
      })

      await handler({ method: 'GET', path: '/api/custom', context: {} } as any)

      expect(handlerSpy.mock.calls[0][0].queryParams).toEqual({ page: 1 })
    })
  })

  describe('transform', () => {
    it('should apply transform to result', async () => {
      const handler = createEndpoint({
        handler: async () => ({ value: 5 }),
        transform: (result) => ({ ...result, doubled: result.value * 2 }),
      })

      const result = await handler({ method: 'GET', path: '/api/custom', context: {} } as any)

      expect(result).toEqual({ data: { value: 5, doubled: 10 } })
    })
  })

  describe('responseFormat', () => {
    it('should wrap in { data } with auto format', async () => {
      const handler = createEndpoint({
        responseFormat: 'auto',
        handler: async () => ({ hello: 'world' }),
      })

      const result = await handler({ method: 'GET', path: '/api/custom', context: {} } as any)
      expect(result).toEqual({ data: { hello: 'world' } })
    })

    it('should pass through with raw format', async () => {
      const handler = createEndpoint({
        responseFormat: 'raw',
        handler: async () => ({ hello: 'world' }),
      })

      const result = await handler({ method: 'GET', path: '/api/custom', context: {} } as any)
      expect(result).toEqual({ hello: 'world' })
    })
  })
})
