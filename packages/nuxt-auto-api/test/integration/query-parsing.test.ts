import { describe, it, expect, vi } from 'vitest'
import { createValidationMiddleware } from '../../src/runtime/server/middleware/validate'
import { createMockContext } from '../helpers/mocks'
import { z } from 'zod'

// Mock h3
vi.mock('h3', () => ({
  readBody: (event: any) => event.body,
  getQuery: (event: any) => event.query || {},
  createError: (err: any) => {
    const error = new Error(err.message || 'Error')
    Object.assign(error, err)
    return error
  },
}))

describe('Query Parsing Integration', () => {
  const baseSchema = {
    // Schema requiring filter to be an object (not string)
    query: z.object({
      filter: z.record(z.string(), z.any()).optional(),
    }),
  }

  const validate = createValidationMiddleware(baseSchema)

  it('should parse JSON string filter into object', async () => {
    const context = createMockContext({
      resource: 'posts',
      operation: 'list',
      query: {
        filter: '{"published":true,"userId":1}',
      },
    })

    await validate(context as any)

    expect(context.validated.query).toBeDefined()
    expect(context.validated.query.filter).toEqual({
      published: true,
      userId: 1,
    })
    // Original query should also be updated by the middleware reference modification
    expect(typeof context.query.filter).toBe('object')
  })

  it('should leave already parsed object filter as is', async () => {
    const context = createMockContext({
      resource: 'posts',
      operation: 'list',
      query: {
        filter: { published: true },
      },
    })

    await validate(context as any)

    expect(context.validated.query.filter).toEqual({ published: true })
  })

  it('should handle invalid JSON gracefully (leave as string and let validation fail)', async () => {
    const context = createMockContext({
      resource: 'posts',
      operation: 'list',
      query: {
        filter: '{invalid-json',
      },
    })

    // Should throw validation error because "filter" expects record, but gets string (parsing failed)
    await expect(validate(context as any)).rejects.toThrow('Validation error')
  })

  it('should handle non-string/non-object filter (if possible) by validation failure', async () => {
     const context = createMockContext({
      resource: 'posts',
      operation: 'list',
      query: {
        filter: 123 as any,
      },
    })

    await expect(validate(context as any)).rejects.toThrow('Validation error')
  })
  
  it('should handle undefined filter', async () => {
    const context = createMockContext({
      resource: 'posts',
      operation: 'list',
      query: {},
    })

    await validate(context as any)
    expect(context.validated.query.filter).toBeUndefined()
  })
})
