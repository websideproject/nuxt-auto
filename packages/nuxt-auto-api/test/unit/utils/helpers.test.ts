import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock h3
vi.mock('h3', () => ({
  readBody: vi.fn(async () => ({})),
  getQuery: vi.fn(() => ({})),
  createError: (opts: any) => {
    const error = new Error(opts.message) as any
    error.statusCode = opts.statusCode
    error.data = opts.data
    return error
  },
}))

// Mock database
const mockAdapter = {
  engine: 'better-sqlite3',
  db: { query: {} },
  atomic: vi.fn(),
  getMutationCount: vi.fn(),
  supportsReturning: true,
  supportsNativeBatch: false,
}

vi.mock('../../../src/runtime/server/database', () => ({
  getDatabaseAdapter: vi.fn(() => mockAdapter),
}))

// Mock plugin registry
vi.mock('../../../src/runtime/server/plugins/pluginRegistry', () => ({
  getContextExtenders: vi.fn(() => []),
}))

// Mock serializeResponse
vi.mock('../../../src/runtime/server/utils/serializeResponse', () => ({
  serializeResponse: vi.fn((data: any) => data),
}))

// Mock filterHiddenFields
vi.mock('../../../src/runtime/server/utils/filterHiddenFields', () => ({
  filterHiddenFields: vi.fn((data: any) => data),
}))

import {
  getAutoApiContext,
  validateBody,
  validateQuery,
  respondWith,
  respondWithList,
  respondWithError,
  getDb,
} from '../../../src/runtime/server/utils/helpers'

describe('helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAutoApiContext', () => {
    it('should return a HandlerContext with database', async () => {
      const mockEvent = {
        context: { user: { id: 1 }, params: { id: '5' } },
      } as any

      const ctx = await getAutoApiContext(mockEvent)

      expect(ctx.db).toBe(mockAdapter.db)
      expect(ctx.adapter).toBe(mockAdapter)
      expect(ctx.user).toEqual({ id: 1 })
    })

    it('should accept optional resource and operation', async () => {
      const mockEvent = { context: {} } as any
      const ctx = await getAutoApiContext(mockEvent, { resource: 'posts', operation: 'list' })

      expect(ctx.resource).toBe('posts')
      expect(ctx.operation).toBe('list')
    })

    it('should default resource to empty and operation to get', async () => {
      const mockEvent = { context: {} } as any
      const ctx = await getAutoApiContext(mockEvent)

      expect(ctx.resource).toBe('')
      expect(ctx.operation).toBe('get')
    })

    it('should run context extenders', async () => {
      const { getContextExtenders } = await import('../../../src/runtime/server/plugins/pluginRegistry')
      const extender = vi.fn(async (ctx: any) => { ctx.customField = 'added' })
      vi.mocked(getContextExtenders).mockReturnValueOnce([extender])

      const mockEvent = { context: {} } as any
      const ctx = await getAutoApiContext(mockEvent)

      expect(extender).toHaveBeenCalledWith(ctx)
    })
  })

  describe('validateBody', () => {
    it('should return parsed data on success', async () => {
      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({ name: 'Alice' })

      const schema = {
        safeParse: vi.fn().mockReturnValue({
          success: true,
          data: { name: 'Alice' },
        }),
      }

      const result = await validateBody({} as any, schema)
      expect(result).toEqual({ name: 'Alice' })
    })

    it('should throw 400 on validation failure', async () => {
      const { readBody } = await import('h3')
      vi.mocked(readBody).mockResolvedValueOnce({})

      const schema = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: { issues: [{ message: 'required' }] },
        }),
      }

      await expect(validateBody({} as any, schema)).rejects.toThrow('Body validation failed')
    })
  })

  describe('validateQuery', () => {
    it('should return parsed data on success', async () => {
      const { getQuery } = await import('h3')
      vi.mocked(getQuery).mockReturnValue({ page: '1' } as any)

      const schema = {
        safeParse: vi.fn().mockReturnValue({
          success: true,
          data: { page: 1 },
        }),
      }

      const result = validateQuery({} as any, schema)
      expect(result).toEqual({ page: 1 })
    })

    it('should throw 400 on validation failure', async () => {
      const { getQuery } = await import('h3')
      vi.mocked(getQuery).mockReturnValue({} as any)

      const schema = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: { issues: [{ message: 'invalid' }] },
        }),
      }

      expect(() => validateQuery({} as any, schema)).toThrow('Query validation failed')
    })
  })

  describe('respondWith', () => {
    it('should wrap data in { data } envelope', () => {
      const result = respondWith({ id: 1, name: 'Alice' })
      expect(result).toEqual({ data: { id: 1, name: 'Alice' } })
    })

    it('should handle arrays', () => {
      const result = respondWith([1, 2, 3])
      expect(result).toEqual({ data: [1, 2, 3] })
    })
  })

  describe('respondWithList', () => {
    it('should wrap list data with meta', () => {
      const result = respondWithList(
        [{ id: 1 }, { id: 2 }],
        { total: 50, page: 1 }
      )

      expect(result).toEqual({
        data: [{ id: 1 }, { id: 2 }],
        meta: { total: 50, page: 1 },
      })
    })

    it('should default meta to empty object', () => {
      const result = respondWithList([{ id: 1 }])
      expect(result).toEqual({
        data: [{ id: 1 }],
        meta: {},
      })
    })
  })

  describe('respondWithError', () => {
    it('should throw an error with status code', () => {
      expect(() => respondWithError(404, 'Not found')).toThrow('Not found')
    })

    it('should include details when provided', () => {
      try {
        respondWithError(422, 'Validation error', { field: 'email' })
      } catch (e: any) {
        expect(e.statusCode).toBe(422)
        expect(e.data).toEqual({ details: { field: 'email' } })
      }
    })
  })

  describe('getDb', () => {
    it('should return db and adapter', () => {
      const result = getDb()
      expect(result.db).toBe(mockAdapter.db)
      expect(result.adapter).toBe(mockAdapter)
    })
  })
})
