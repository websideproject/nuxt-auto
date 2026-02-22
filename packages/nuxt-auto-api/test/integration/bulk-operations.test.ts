import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { bulkCreateHandler, bulkUpdateHandler, bulkDeleteHandler } from '../../src/runtime/server/handlers/bulk'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { createMockContext } from '../helpers/mocks'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('Bulk Operations Integration', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)

    // Mock transaction to support async callback (needed for better-sqlite3 in tests)
    db.transaction = async (fn: any) => {
      // Use SQL savepoints to simulate transaction since better-sqlite3 transaction() is sync
      sqlite.prepare('SAVEPOINT test_tx').run()
      try {
        const result = await fn(db)
        sqlite.prepare('RELEASE SAVEPOINT test_tx').run()
        return result
      } catch (error) {
        sqlite.prepare('ROLLBACK TO SAVEPOINT test_tx').run()
        throw error
      }
    }
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('Bulk Create', () => {
    it('should create multiple posts in one request', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: [
              {
                title: 'Bulk Post 1',
                content: 'Content 1',
                userId: user.id,
                published: true
              },
              {
                title: 'Bulk Post 2',
                content: 'Content 2',
                userId: user.id,
                published: false
              },
              {
                title: 'Bulk Post 3',
                content: 'Content 3',
                userId: user.id,
                published: true
              }
            ]
          }
        }
      })

      const result = await bulkCreateHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(3)
      expect(result.meta.total).toBe(3)
      expect(result.meta.successful).toBe(3)
      expect(result.meta.failed).toBe(0)

      // Verify all posts were created
      result.data.forEach((post: any) => {
        expect(post).toHaveProperty('id')
        expect(post).toHaveProperty('title')
        expect(post.userId).toBe(user.id)
      })
    })

    it('should return empty array for empty items', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: []
          }
        }
      })

      const result = await bulkCreateHandler(context as any)

      expect(result.data).toEqual([])
      expect(result.meta.total).toBe(0)
      expect(result.meta.successful).toBe(0)
      expect(result.meta.failed).toBe(0)
    })

    it('should enforce batch size limit', async () => {
      const user = testData.users[0]
      const items = Array.from({ length: 101 }, (_, i) => ({
        title: `Post ${i}`,
        content: `Content ${i}`,
        userId: user.id,
        published: true
      }))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: { items }
        }
      })

      // Should throw error if batch exceeds max (default 100)
      await expect(bulkCreateHandler(context as any)).rejects.toThrow(/batch size/i)
    })
  })

  describe('Bulk Update', () => {
    it('should update multiple posts in one request', async () => {
      const posts = testData.posts

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: [
              {
                id: posts[0].id,
                data: { title: 'Updated Title 1', published: true }
              },
              {
                id: posts[1].id,
                data: { title: 'Updated Title 2', published: false }
              }
            ]
          }
        }
      })

      const result = await bulkUpdateHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(2)
      expect(result.meta.successful).toBe(2)
      expect(result.meta.failed).toBe(0)

      expect(result.data[0].title).toBe('Updated Title 1')
      expect(result.data[0].published).toBe(true)
      expect(result.data[1].title).toBe('Updated Title 2')
      expect(result.data[1].published).toBe(false)
    })

    it('should handle non-existent IDs gracefully', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: [
              {
                id: 999999,
                data: { title: 'This should fail' }
              }
            ]
          }
        }
      })

      // With transactional mode (default), this should throw
      await expect(bulkUpdateHandler(context as any)).rejects.toThrow()
    })

    it('should validate item structure', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: [
              { title: 'Missing id and data' } as any
            ]
          }
        }
      })

      await expect(bulkUpdateHandler(context as any)).rejects.toThrow(/id.*data/i)
    })
  })

  describe('Bulk Delete', () => {
    it('should delete multiple posts in one request', async () => {
      const posts = testData.posts

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            ids: [posts[0].id, posts[1].id]
          }
        }
      })

      const result = await bulkDeleteHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(2)
      expect(result.meta.successful).toBe(2)
      expect(result.meta.failed).toBe(0)

      result.data.forEach((item: any) => {
        expect(item).toHaveProperty('id')
        expect(item.deleted).toBe(true)
      })

      // Verify posts are deleted
      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {}
      })

      const listResult = await listHandler(listContext as any)
      const remainingIds = listResult.data.map((p: any) => p.id)
      expect(remainingIds).not.toContain(posts[0].id)
      expect(remainingIds).not.toContain(posts[1].id)
    })

    it('should handle empty ID array', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            ids: []
          }
        }
      })

      const result = await bulkDeleteHandler(context as any)

      expect(result.data).toEqual([])
      expect(result.meta.total).toBe(0)
    })
  })

  describe('Transaction behavior', () => {
    it('should rollback all changes on error in transactional mode', async () => {
      const posts = testData.posts

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: [
              {
                id: posts[0].id,
                data: { title: 'Valid Update' }
              },
              {
                id: 999999, // Non-existent ID
                data: { title: 'Invalid Update' }
              }
            ]
          }
        }
      })

      // Should fail and rollback everything
      await expect(bulkUpdateHandler(context as any)).rejects.toThrow()

      // Verify first post was not updated (rollback worked)
      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {}
      })

      const listResult = await listHandler(listContext as any)
      const post = listResult.data.find((p: any) => p.id === posts[0].id)
      expect(post.title).not.toBe('Valid Update')
      expect(post.title).toBe(posts[0].title) // Original title
    })
  })

  describe('Metadata', () => {
    it('should provide detailed metadata', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: [
              { title: 'Post 1', content: 'Content', userId: user.id, published: true },
              { title: 'Post 2', content: 'Content', userId: user.id, published: true }
            ]
          }
        }
      })

      const result = await bulkCreateHandler(context as any)

      expect(result.meta).toHaveProperty('total')
      expect(result.meta).toHaveProperty('successful')
      expect(result.meta).toHaveProperty('failed')
      expect(result.meta.total).toBe(2)
      expect(result.meta.successful).toBe(2)
      expect(result.meta.failed).toBe(0)
      expect(result.meta.errors).toBeUndefined()
    })
  })

  describe('Multi-tenancy support', () => {
    it('should auto-set tenant ID in bulk create', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'bulk',
        query: {},
        validated: {
          body: {
            items: [
              { title: 'Post 1', content: 'Content', userId: user.id, published: true },
              { title: 'Post 2', content: 'Content', userId: user.id, published: true }
            ]
          }
        },
        tenant: {
          id: 'org-123',
          field: 'organizationId',
          canAccessAllTenants: false
        }
      })

      const result = await bulkCreateHandler(context as any)

      // Verify tenant ID was set on all items
      result.data.forEach((post: any) => {
        expect(post.organizationId).toBe('org-123')
      })
    })
  })
})
