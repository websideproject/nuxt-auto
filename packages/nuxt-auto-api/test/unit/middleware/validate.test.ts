import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { createValidationMiddleware } from '../../../src/runtime/server/middleware/validate'
import { createMockContext, createMockH3Event } from '../../helpers/mocks'

// Mock h3 functions
vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    readBody: vi.fn(async () => ({})),
    createError: (opts: any) => {
      const error = new Error(opts.message)
      Object.assign(error, opts)
      return error
    },
  }
})

describe('Validation Middleware', () => {
  describe('createValidationMiddleware', () => {
    it('should validate query params with custom schema', async () => {
      const schemas = {
        query: z.object({
          page: z.coerce.number().min(1),
          limit: z.coerce.number().min(1).max(100),
        }),
      }

      const middleware = createValidationMiddleware(schemas)
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'list',
        query: { page: '1', limit: '20' },
      })

      await middleware(context as any)

      expect(context.validated.query).toEqual({ page: 1, limit: 20 })
    })

    it('body: false validates the query and leaves the body alone (custom endpoints)', async () => {
      const schemas = {
        query: z.object({ page: z.coerce.number().optional() }),
        create: z.object({ title: z.string().min(1) }), // a row the custom body doesn't look like
      }
      const { readBody } = await import('h3')
      vi.mocked(readBody).mockClear()
      const middleware = createValidationMiddleware(schemas)
      const context = createMockContext({ event: createMockH3Event(), operation: 'create', query: { page: '2' } })

      await middleware(context as any, { body: false })

      expect(context.validated.query).toEqual({ page: 2 })
      expect(context.validated.body).toBeUndefined()
      expect(readBody, 'the body is not even read').not.toHaveBeenCalled()
    })

    it('bulk: every invalid item is reported, not only the first', async () => {
      const schemas = { create: z.object({ title: z.string().min(3) }), update: z.object({ title: z.string().min(3) }) }
      const { readBody } = await import('h3')
      const middleware = createValidationMiddleware(schemas)

      vi.mocked(readBody).mockResolvedValueOnce({ items: [{ title: 'ok!' }, { title: 'x' }, 'nope', { title: 'y' }] })
      const create = createMockContext({ event: createMockH3Event(), operation: 'create', query: {} })
      ;(create as any).bulk = true
      const error: any = await middleware(create as any).catch(e => e)
      expect(error.statusCode).toBe(400)
      expect(error.data.errors.map((i: any) => i.path)).toEqual([['items', 1, 'title'], ['items', 2], ['items', 3, 'title']])

      vi.mocked(readBody).mockResolvedValueOnce({ items: [{ id: 1, data: { title: 'a' } }, { id: 2 }, { id: 3, data: { title: 'fine' } }] })
      const update = createMockContext({ event: createMockH3Event(), operation: 'update', query: {} })
      ;(update as any).bulk = true
      const updateError: any = await middleware(update as any).catch(e => e)
      expect(updateError.data.errors.map((i: any) => i.path)).toEqual([['items', 0, 'data', 'title'], ['items', 1]])
    })

    it('should validate body for create operation', async () => {
      const schemas = {
        create: z.object({
          title: z.string().min(1),
          content: z.string(),
        }),
      }

      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ title: 'Test', content: 'Content' })

      const middleware = createValidationMiddleware(schemas)
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'create',
        query: {},
      })

      await middleware(context as any)

      expect(context.validated.body).toEqual({ title: 'Test', content: 'Content' })
    })

    it('should validate body for update operation', async () => {
      const schemas = {
        update: z.object({
          title: z.string().optional(),
          content: z.string().optional(),
        }),
      }

      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ title: 'Updated' })

      const middleware = createValidationMiddleware(schemas)
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'update',
        query: {},
      })

      await middleware(context as any)

      expect(context.validated.body).toEqual({ title: 'Updated' })
    })

    it('should throw validation error for invalid data', async () => {
      const schemas = {
        create: z.object({
          email: z.string().email(),
        }),
      }

      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ email: 'invalid-email' })

      const middleware = createValidationMiddleware(schemas)
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'create',
        query: {},
      })

      await expect(middleware(context as any)).rejects.toThrow('Validation error')
    })

    it('should pass through body when no validation schema', async () => {
      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ title: 'Test' })

      const middleware = createValidationMiddleware({})
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'create',
        query: {},
      })

      await middleware(context as any)

      expect(context.validated.body).toEqual({ title: 'Test' })
    })

    it('should not validate body for list operation', async () => {
      const middleware = createValidationMiddleware({})
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'list',
        query: {},
      })

      await middleware(context as any)

      expect(context.validated.body).toBeUndefined()
    })

    it('should not validate body for get operation', async () => {
      const middleware = createValidationMiddleware({})
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'get',
        query: {},
      })

      await middleware(context as any)

      expect(context.validated.body).toBeUndefined()
    })

    it('should coerce query string values to numbers', async () => {
      const schemas = {
        query: z.object({
          page: z.coerce.number(),
          limit: z.coerce.number(),
        }),
      }

      const middleware = createValidationMiddleware(schemas)
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'list',
        query: { page: '5', limit: '50' },
      })

      await middleware(context as any)

      expect(context.validated.query).toEqual({ page: 5, limit: 50 })
    })

    it('should throw error with validation details', async () => {
      const schemas = {
        create: z.object({
          title: z.string().min(3),
          age: z.number().min(18),
        }),
      }

      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ title: 'ab', age: 10 })

      const middleware = createValidationMiddleware(schemas)
      const event = createMockH3Event()

      const context = createMockContext({
        event,
        operation: 'create',
        query: {},
      })

      try {
        await middleware(context as any)
        expect.fail('Should have thrown validation error')
      }
      catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.data.errors).toBeDefined()
        expect(error.data.errors.length).toBeGreaterThan(0)
      }
    })
  })
})
