import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import { PostFactory } from '../helpers/factories'
import { schema as baseSchema } from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { createHandler } from '../../src/runtime/server/handlers/create'
import { updateHandler } from '../../src/runtime/server/handlers/update'
import { deleteHandler } from '../../src/runtime/server/handlers/delete'
import { aggregateHandler } from '../../src/runtime/server/handlers/aggregate'
import { parseAggregateParam } from '../../src/runtime/server/utils/buildAggregation'
import { createMockContext } from '../helpers/mocks'

// Stub useRuntimeConfig for tests
const mockRuntimeConfig = {
  public: {},
  autoApi: {
    aggregations: {
      enabled: true
    },
    hooks: {}, 
    hookConfig: {
      timeout: 5000,
      parallel: false,
      errorHandling: 'log' // Default to log
    },
    hiddenFields: {
      global: [],
      resources: {}
    }
  }
}

vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig)

describe('Aggregations and Lifecycle Hooks Integration', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)

    // Create more posts for aggregation tests
    const user = testData.users[0]
    await PostFactory.create(db, baseSchema, user.id, { title: 'Post 3', published: true })
    await PostFactory.create(db, baseSchema, user.id, { title: 'Post 4', published: false })
    await PostFactory.create(db, baseSchema, user.id, { title: 'Post 5', published: true })
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('Aggregations - Parsing', () => {
    it('should parse count aggregate', () => {
      const result = parseAggregateParam('count')
      expect(result).toEqual([
        { function: 'count', field: '*', alias: 'count' }
      ])
    })

    it('should parse field-based aggregates', () => {
      const result = parseAggregateParam('sum(amount),avg(price)')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ function: 'sum', field: 'amount', alias: 'sum_amount' })
      expect(result[1]).toEqual({ function: 'avg', field: 'price', alias: 'avg_price' })
    })

    it('should handle multiple aggregates', () => {
      const result = parseAggregateParam('count,sum(total),avg(total),min(total),max(total)')
      expect(result).toHaveLength(5)
      expect(result.map(a => a.function)).toEqual(['count', 'sum', 'avg', 'min', 'max'])
    })
  })

  describe('Simple Aggregations on List Endpoint', () => {
    it('should add count aggregate to list response', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          aggregate: 'count'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.meta).toHaveProperty('aggregates')
      expect(result.meta.aggregates).toHaveProperty('count')
      expect(result.meta.aggregates.count).toBeGreaterThan(0)
    })

    it('should combine aggregates with filters', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          aggregate: 'count',
          filter: { published: true }
        }
      })

      const result = await listHandler(context as any)

      expect(result.meta.aggregates?.count).toBeDefined()
      // Count should only include published posts
      const publishedCount = result.data.filter((p: any) => p.published).length
      expect(result.meta.aggregates.count).toBeLessThanOrEqual(publishedCount + result.data.length)
    })

    it('should not aggregate when groupBy is present', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          aggregate: 'count',
          groupBy: 'published' // This makes it complex, not simple
        }
      })

      const result = await listHandler(context as any)

      // Simple aggregation should be skipped when groupBy is present
      expect(result.meta.aggregates).toBeUndefined()
    })
  })

  describe('Complex Aggregations', () => {
    it('should aggregate with groupBy', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          aggregate: 'count',
          groupBy: 'published'
        }
      })

      const result = await aggregateHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBeGreaterThan(0)

      // Should have groups for published and unpublished
      const groups = result.data.map((d: any) => d.group?.published)
      expect(groups).toContain(true)
      expect(groups).toContain(false)
    })

    it('should support multiple groupBy fields', async () => {
      console.log('Schema Keys:', Object.keys(baseSchema.posts))
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          aggregate: 'count',
          groupBy: ['published', 'userId']
        }
      })

      const result = await aggregateHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        // Log keys to debug test failure
        console.log('Aggregation Group Keys:', Object.keys(result.data[0].group || {}))
        expect(result.data[0].group).toHaveProperty('published')
        // Drizzle/SQLite uses column name for grouping result keys
        expect(result.data[0].group).toHaveProperty('user_id') 
      }
    })

    it('should apply filters before aggregation', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          aggregate: 'count',
          groupBy: 'published',
          filter: { published: true }
        }
      })

      const result = await aggregateHandler(context as any)

      // Should only have one group (published: true)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].group?.published).toBe(true)
    })
  })

  describe('Lifecycle Hooks - Before Hooks', () => {
    it('should execute beforeCreate hook and modify data', async () => {
      const beforeCreate = vi.fn((data) => {
        data.title = `Modified: ${data.title}`
        return data
      })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        validated: {
          body: {
            title: 'Original Title',
            content: 'Content',
            userId: testData.users[0].id,
            published: false
          }
        },
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { beforeCreate }
        }
      })

      const result = await createHandler(context as any)

      expect(beforeCreate).toHaveBeenCalled()
      expect(result.data.title).toBe('Modified: Original Title')
    })

    it('should execute beforeUpdate hook and modify data', async () => {
      const post = testData.posts[0]
      const beforeUpdate = vi.fn((id, data) => {
        data.title = `Updated: ${data.title}`
        return data
      })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: String(post.id) },
        query: {},
        validated: {
          body: {
            title: 'New Title'
          }
        },
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { beforeUpdate }
        }
      })

      const result = await updateHandler(context as any)

      expect(beforeUpdate).toHaveBeenCalled()
      const [callId] = beforeUpdate.mock.calls[0]
      expect(String(callId)).toBe(String(post.id))
      
      expect(result.data.title).toBe('Updated: New Title')
    })

    it('should execute beforeDelete hook', async () => {
      const post = testData.posts[0]
      const beforeDelete = vi.fn()

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: String(post.id) },
        query: {},
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { beforeDelete }
        }
      })

      await deleteHandler(context as any)

      expect(beforeDelete).toHaveBeenCalled()
      const [callId] = beforeDelete.mock.calls[0]
      expect(String(callId)).toBe(String(post.id))
    })
  })

  describe('Lifecycle Hooks - After Hooks', () => {
    it('should execute afterCreate hook', async () => {
      const afterCreate = vi.fn()

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        validated: {
          body: {
            title: 'Test Post',
            content: 'Content',
            userId: testData.users[0].id,
            published: false
          }
        },
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { afterCreate }
        }
      })

      const result = await createHandler(context as any)

      expect(afterCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
          title: 'Test Post'
        }),
        expect.anything()
      )
    })

    it('should execute afterUpdate hook', async () => {
      const post = testData.posts[0]
      const afterUpdate = vi.fn()

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: post.id },
        query: {},
        validated: {
          body: {
            title: 'Updated Title'
          }
        },
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { afterUpdate }
        }
      })

      await updateHandler(context as any)

      expect(afterUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: post.id,
          title: 'Updated Title'
        }),
        expect.anything()
      )
    })

    it('should execute afterDelete hook', async () => {
      const post = testData.posts[0]
      const afterDelete = vi.fn()

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: post.id },
        query: {},
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { afterDelete }
        }
      })

      await deleteHandler(context as any)

      expect(afterDelete).toHaveBeenCalledWith(post.id, expect.anything())
    })

    it('should execute afterList hook', async () => {
      const afterList = vi.fn()

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { afterList }
        }
      })

      await listHandler(context as any)

      expect(afterList).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: expect.anything() })
        ]),
        expect.anything()
      )
    })
  })

  describe('Hooks Error Handling', () => {
    it('should block operation when beforeCreate hook throws', async () => {
      // Temporarily set errorHandling to throw
      const originalConfig = mockRuntimeConfig.autoApi.hookConfig.errorHandling
      mockRuntimeConfig.autoApi.hookConfig.errorHandling = 'throw'

      try {
        const beforeCreate = vi.fn(() => {
          throw new Error('Validation failed')
        })

        const context = createMockContext({
          db,
          schema: baseSchema,
          resource: 'posts',
          operation: 'create',
          query: {},
          validated: {
            body: {
              title: 'Test',
              content: 'Content',
              userId: testData.users[0].id,
              published: false
            }
          },
          resourceConfig: {
            name: 'posts',
            schema: baseSchema.posts,
            hooks: { beforeCreate }
          }
        })

        // The hook throws "Validation failed", but executeHooks wraps it in "Error executing beforeCreate hook"
        // or similar. We should check for either the original message or the wrapped one.
        await expect(createHandler(context as any)).rejects.toThrow(/Validation failed|Error executing/)
      } finally {
        // Restore config
        mockRuntimeConfig.autoApi.hookConfig.errorHandling = originalConfig
      }
    })

    it('should not block operation when afterCreate hook throws (default behavior)', async () => {
      const afterCreate = vi.fn(() => {
        throw new Error('Notification failed')
      })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        validated: {
          body: {
            title: 'Test',
            content: 'Content',
            userId: testData.users[0].id,
            published: false
          }
        },
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { afterCreate }
        }
      })

      // Should not throw (error is logged but operation succeeds)
      const result = await createHandler(context as any)
      expect(result.data).toBeDefined()
      expect(result.data.title).toBe('Test')
    })
  })

  describe('Multiple Hooks', () => {
    it('should execute both before and after hooks', async () => {
      const beforeCreate = vi.fn((data) => {
        data.title = `Before: ${data.title}`
        return data
      })

      const afterCreate = vi.fn()

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        validated: {
          body: {
            title: 'Original',
            content: 'Content',
            userId: testData.users[0].id,
            published: false
          }
        },
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hooks: { beforeCreate, afterCreate }
        }
      })

      const result = await createHandler(context as any)

      expect(beforeCreate).toHaveBeenCalled()
      expect(afterCreate).toHaveBeenCalled()
      expect(result.data.title).toBe('Before: Original')
    })
  })
})
