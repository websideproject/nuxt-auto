import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineAutoApiHandler } from '../../../src/runtime/server/utils/defineAutoApiHandler'
import { createContextFromRegistry } from '../../../src/runtime/server/handlers/createContextFromRegistry'
import type { HandlerContext } from '../../../src/runtime/types'

// Mock dependencies
vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  createError: (error: any) => error,
}))

vi.mock('../../../src/runtime/server/handlers/createContextFromRegistry', () => ({
  createContextFromRegistry: vi.fn(),
}))

describe('defineAutoApiHandler', () => {
  const mockContext: HandlerContext = {
    db: {},
    schema: {},
    user: { id: 1, email: 'test@example.com' },
    permissions: ['user'],
    params: { id: '123' },
    query: {},
    validated: {},
    event: {} as any,
    resource: 'users',
    operation: 'get',
  }

  const mockAuthorize = vi.fn()
  const mockValidate = vi.fn()
  const mockRunMiddleware = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthorize.mockReset()
    mockValidate.mockReset()
    mockRunMiddleware.mockReset()

    // Setup default mock return
    vi.mocked(createContextFromRegistry).mockResolvedValue({
      context: mockContext,
      authorize: mockAuthorize,
      validate: mockValidate,
      runMiddleware: mockRunMiddleware,
    } as any)
  })

  describe('basic functionality', () => {
    it('should create a handler function', () => {
      const handler = defineAutoApiHandler({
        execute: async (context) => ({ data: 'test' }),
      })

      expect(typeof handler).toBe('function')
    })

    it('should execute custom logic', async () => {
      const executeSpy = vi.fn().mockResolvedValue({ data: 'custom result' })

      const handler = defineAutoApiHandler({
        execute: executeSpy,
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      const result = await handler(mockEvent as any)

      expect(executeSpy).toHaveBeenCalledWith(mockContext)
      expect(result).toEqual({ data: 'custom result' })
    })

    it('should run authorization by default', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'test' }),
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      await handler(mockEvent as any)

      expect(mockAuthorize).toHaveBeenCalledWith(mockContext)
    })

    it('should run validation by default', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'test' }),
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      await handler(mockEvent as any)

      expect(mockValidate).toHaveBeenCalledWith(mockContext)
    })
  })

  describe('skip options', () => {
    it('should skip authorization when requested', async () => {
      const handler = defineAutoApiHandler({
        skipAuthorization: true,
        execute: async () => ({ data: 'test' }),
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      await handler(mockEvent as any)

      expect(mockAuthorize).not.toHaveBeenCalled()
      expect(mockValidate).toHaveBeenCalled()
    })

    it('should skip validation when requested', async () => {
      const handler = defineAutoApiHandler({
        skipValidation: true,
        execute: async () => ({ data: 'test' }),
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      await handler(mockEvent as any)

      expect(mockAuthorize).toHaveBeenCalled()
      expect(mockValidate).not.toHaveBeenCalled()
    })

    it('should skip both when requested', async () => {
      const handler = defineAutoApiHandler({
        skipAuthorization: true,
        skipValidation: true,
        execute: async () => ({ data: 'test' }),
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      await handler(mockEvent as any)

      expect(mockAuthorize).not.toHaveBeenCalled()
      expect(mockValidate).not.toHaveBeenCalled()
    })
  })

  describe('transform option', () => {
    it('should apply transform to result', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ value: 10 }),
        transform: (result, context) => ({
          ...result,
          doubled: result.value * 2,
          userId: context.user?.id,
        }),
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        value: 10,
        doubled: 20,
        userId: 1,
      })
    })

    it('should pass context to transform', async () => {
      const transformSpy = vi.fn((result, context) => result)

      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'test' }),
        transform: transformSpy,
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      await handler(mockEvent as any)

      expect(transformSpy).toHaveBeenCalledWith(
        { data: 'test' },
        mockContext
      )
    })

    it('should not transform when option not provided', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'original' }),
      })

      const mockEvent = {
        path: '/api/users/123',
        method: 'GET',
      }

      const result = await handler(mockEvent as any)

      expect(result).toEqual({ data: 'original' })
    })
  })

  describe('operation detection', () => {
    it('should detect GET operation for single resource', async () => {
      const executeSpy = vi.fn().mockResolvedValue({ data: 'test' })

      const handler = defineAutoApiHandler({
        execute: executeSpy,
      })

      await handler({
        path: '/api/users/123',
        method: 'GET',
      } as any)

      expect(createContextFromRegistry).toHaveBeenCalledWith(
        expect.anything(),
        'get'
      )
    })

    it('should detect list operation for collection', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ data: [] }),
      })

      await handler({
        path: '/api/users',
        method: 'GET',
      } as any)

      expect(createContextFromRegistry).toHaveBeenCalledWith(
        expect.anything(),
        'list'
      )
    })

    it('should detect POST operation', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'created' }),
      })

      await handler({
        path: '/api/users',
        method: 'POST',
      } as any)

      expect(createContextFromRegistry).toHaveBeenCalledWith(
        expect.anything(),
        'create'
      )
    })

    it('should detect PATCH operation', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'updated' }),
      })

      await handler({
        path: '/api/users/123',
        method: 'PATCH',
      } as any)

      expect(createContextFromRegistry).toHaveBeenCalledWith(
        expect.anything(),
        'update'
      )
    })

    it('should detect DELETE operation', async () => {
      const handler = defineAutoApiHandler({
        execute: async () => ({ success: true }),
      })

      await handler({
        path: '/api/users/123',
        method: 'DELETE',
      } as any)

      expect(createContextFromRegistry).toHaveBeenCalledWith(
        expect.anything(),
        'delete'
      )
    })
  })

  describe('error handling', () => {
    it('should propagate execution errors', async () => {
      const error = new Error('Execution failed')

      const handler = defineAutoApiHandler({
        execute: async () => {
          throw error
        },
      })

      await expect(handler({
        path: '/api/users/123',
        method: 'GET',
      } as any)).rejects.toThrow('Execution failed')
    })

    it('should propagate authorization errors', async () => {
      mockAuthorize.mockRejectedValue(new Error('Unauthorized'))

      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'test' }),
      })

      await expect(handler({
        path: '/api/users/123',
        method: 'GET',
      } as any)).rejects.toThrow('Unauthorized')
    })

    it('should propagate validation errors', async () => {
      mockValidate.mockRejectedValue(new Error('Validation failed'))

      const handler = defineAutoApiHandler({
        execute: async () => ({ data: 'test' }),
      })

      await expect(handler({
        path: '/api/users/123',
        method: 'GET',
      } as any)).rejects.toThrow('Validation failed')
    })
  })

  describe('real-world scenarios', () => {
    it('should support stats endpoint pattern', async () => {
      const handler = defineAutoApiHandler({
        async execute(context) {
          const userId = context.params.id

          // Simulate fetching stats
          const stats = {
            postCount: 10,
            commentCount: 25,
          }

          return {
            data: {
              userId,
              stats,
            },
          }
        },
      })

      const result = await handler({
        path: '/api/users/123/stats',
        method: 'GET',
      } as any)

      expect(result.data.userId).toBe('123')
      expect(result.data.stats.postCount).toBe(10)
    })

    it('should support bulk operations', async () => {
      const handler = defineAutoApiHandler({
        async execute(context) {
          const items = context.validated.body?.items || []

          return {
            data: items.map((item: any) => ({ ...item, processed: true })),
            meta: { count: items.length },
          }
        },
      })

      const mockContextWithBody = {
        ...mockContext,
        validated: {
          body: {
            items: [{ id: 1 }, { id: 2 }],
          },
        },
      }

      vi.mocked(createContextFromRegistry).mockResolvedValueOnce({
        context: mockContextWithBody,
        authorize: mockAuthorize,
        validate: mockValidate,
        runMiddleware: mockRunMiddleware,
      } as any)

      const result = await handler({
        path: '/api/users/bulk',
        method: 'POST',
      } as any)

      expect(result.data.length).toBe(2)
      expect(result.meta.count).toBe(2)
    })
  })
})
