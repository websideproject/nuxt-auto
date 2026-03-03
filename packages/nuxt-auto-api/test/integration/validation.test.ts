import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { createHandler } from '../../src/runtime/server/handlers/create'
import { updateHandler } from '../../src/runtime/server/handlers/update'
import { createMockContext } from '../helpers/mocks'
import { createValidationMiddleware } from '../../src/runtime/server/middleware/validate'
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

describe('Validation Integration', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('Create with validation', () => {
    it('should validate email format', async () => {
      const schema = {
        create: z.object({
          email: z.string().email(),
          name: z.string().min(2),
        }),
      }

      const validate = createValidationMiddleware(schema)
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'create',
        query: {},
        event: {
          body: { email: 'invalid-email', name: 'Test User' },
        } as any,
      })

      await expect(validate(context as any)).rejects.toThrow()
    })

    it('should accept valid data', async () => {
      const schema = {
        create: z.object({
          email: z.string().email(),
          name: z.string().min(2),
        }),
      }

      const validate = createValidationMiddleware(schema)
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'create',
        query: {},
        event: {
          body: { email: 'valid@example.com', name: 'Test User' },
        } as any,
      })

      await validate(context as any)

      expect(context.validated.body).toBeDefined()
      expect(context.validated.body.email).toBe('valid@example.com')
    })

    it('should transform data during validation', async () => {
      const schema = {
        create: z.object({
          email: z.string().email().transform(v => v.toLowerCase()),
          name: z.string().trim(),
        }),
      }

      const validate = createValidationMiddleware(schema)
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'create',
        query: {},
        event: {
          body: { email: 'TEST@EXAMPLE.COM', name: '  John Doe  ' },
        } as any,
      })

      await validate(context as any)

      expect(context.validated.body.email).toBe('test@example.com')
      expect(context.validated.body.name).toBe('John Doe')
    })
  })

  describe('Update with validation', () => {
    it('should validate partial updates', async () => {
      const schema = {
        update: z.object({
          email: z.string().email().optional(),
          name: z.string().min(2).optional(),
        }),
      }

      const validate = createValidationMiddleware(schema)
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'update',
        params: { id: testData.users[0].id.toString() },
        query: {},
        event: {
          body: { name: 'Updated Name' },
        } as any,
      })

      await validate(context as any)

      expect(context.validated.body).toBeDefined()
      expect(context.validated.body.name).toBe('Updated Name')
    })

    it('should reject invalid partial updates', async () => {
      const schema = {
        update: z.object({
          email: z.string().email().optional(),
          name: z.string().min(2).optional(),
        }),
      }

      const validate = createValidationMiddleware(schema)
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'update',
        params: { id: testData.users[0].id.toString() },
        query: {},
        event: {
          body: { name: 'A' }, // Too short
        } as any,
      })

      await expect(validate(context as any)).rejects.toThrow()
    })
  })

  describe('Query parameter validation', () => {
    it('should validate limit parameter', async () => {
      const schema = {
        query: z.object({
          limit: z.number().int().positive().max(100).optional(),
        }),
      }

      const validate = createValidationMiddleware(schema)
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: { limit: 500 }, // Exceeds max
      })

      await expect(validate(context as any)).rejects.toThrow()
    })

    it('should accept valid query parameters', async () => {
      const schema = {
        query: z.object({
          limit: z.number().int().positive().max(100).optional(),
          page: z.number().int().positive().optional(),
        }),
      }

      const validate = createValidationMiddleware(schema)
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: { limit: 50, page: 2 },
      })

      await validate(context as any)

      expect(context.validated.query).toBeDefined()
      expect(context.validated.query.limit).toBe(50)
      expect(context.validated.query.page).toBe(2)
    })
  })

  describe('Custom validation rules', () => {
    it('should support conditional validation', async () => {
      const schema = {
        create: z.object({
          email: z.string().email(),
          role: z.enum(['user', 'admin']),
        }).refine(
          (data) => {
            // Admins must use company email
            if (data.role === 'admin') {
              return data.email.endsWith('@company.com')
            }
            return true
          },
          {
            message: 'Admin users must use company email',
            path: ['email'],
          }
        ),
      }

      const validate = createValidationMiddleware(schema)

      // Should reject admin with non-company email
      const context1 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'create',
        query: {},
        event: {
          body: { email: 'admin@gmail.com', role: 'admin' },
        } as any,
      })

      await expect(validate(context1 as any)).rejects.toThrow()

      // Should accept admin with company email
      const context2 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'create',
        query: {},
        event: {
          body: { email: 'admin@company.com', role: 'admin' },
        } as any,
      })

      await validate(context2 as any)
      expect(context2.validated.body).toBeDefined()
    })

    it('should support dependent fields', async () => {
      const schema = {
        create: z.object({
          published: z.boolean(),
          publishedAt: z.date().optional(),
        }).refine(
          (data) => {
            // If published, must have publishedAt
            if (data.published) {
              return !!data.publishedAt
            }
            return true
          },
          {
            message: 'Published posts must have a publish date',
            path: ['publishedAt'],
          }
        ),
      }

      const validate = createValidationMiddleware(schema)

      // Should reject published without date
      const context1 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        event: {
          body: { published: true },
        } as any,
      })

      await expect(validate(context1 as any)).rejects.toThrow()

      // Should accept published with date
      const context2 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        event: {
          body: { published: true, publishedAt: new Date() },
        } as any,
      })

      await validate(context2 as any)
      expect(context2.validated.body).toBeDefined()
    })
  })
})
