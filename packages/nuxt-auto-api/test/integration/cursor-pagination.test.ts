import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import { PostFactory, UserFactory } from '../helpers/factories'
import * as baseSchema from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { createMockContext } from '../helpers/mocks'
import { encodeCursor, decodeCursor } from '../../src/runtime/server/utils/cursor'
import { eq } from 'drizzle-orm'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('Cursor Pagination Integration', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)

    // Create additional posts for pagination testing
    for (let i = 0; i < 25; i++) {
      await PostFactory.create(db, baseSchema, testData.users[0].id, {
        title: `Post ${i + 3}`,
        published: i % 2 === 0,
      })
    }
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('First page', () => {
    it('should return first page with cursor', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
        },
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBeLessThanOrEqual(10)
      expect(result.meta.limit).toBe(10)
      expect(result.meta.hasMore).toBeUndefined() // Only set for cursor pagination
    })

    it('should return first page with cursor when cursor param is present', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null, // First page
        },
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(10)
      expect(result.meta.hasMore).toBe(true)
      expect(result.meta.nextCursor).toBeDefined()
    })
  })

  describe('Subsequent pages', () => {
    it('should return next page using cursor', async () => {
      // Get first page
      const context1 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null,
        },
      })

      const result1 = await listHandler(context1 as any)
      expect(result1.meta.nextCursor).toBeDefined()

      // Get second page using cursor
      const context2 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: result1.meta.nextCursor,
        },
      })

      const result2 = await listHandler(context2 as any)

      expect(result2.data).toBeInstanceOf(Array)
      expect(result2.data.length).toBe(10)

      // Ensure no overlap between pages
      const page1Ids = result1.data.map((p: any) => p.id)
      const page2Ids = result2.data.map((p: any) => p.id)
      const overlap = page1Ids.filter((id: any) => page2Ids.includes(id))

      expect(overlap.length).toBe(0)
    })

    it('should indicate when there are more pages', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null,
        },
      })

      const result = await listHandler(context as any)

      expect(result.meta.hasMore).toBe(true)
      expect(result.meta.nextCursor).toBeDefined()
    })

    it('should indicate when on last page', async () => {
      // Get to the last page
      let cursor = null
      let result: any

      for (let i = 0; i < 3; i++) {
        const context = createMockContext({
          db,
          schema: baseSchema,
          resource: 'posts',
          operation: 'list',
          query: {
            limit: 10,
            cursor,
          },
        })

        result = await listHandler(context as any)
        cursor = result.meta.nextCursor

        if (!result.meta.hasMore) break
      }

      // Last page should have hasMore = false
      expect(result.meta.hasMore).toBe(false)
      expect(result.meta.nextCursor).toBeUndefined()
    })
  })

  describe('Cursor with filters', () => {
    it('should support cursor pagination with filters', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 5,
          cursor: null,
          filter: { published: true },
        },
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.every((p: any) => p.published === true)).toBe(true)
      expect(result.data.length).toBeLessThanOrEqual(5)

      if (result.meta.hasMore) {
        expect(result.meta.nextCursor).toBeDefined()
      }
    })

    it('should maintain filter across cursor pages', async () => {
      // First page with filter
      const context1 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 5,
          cursor: null,
          filter: { published: true },
        },
      })

      const result1 = await listHandler(context1 as any)

      if (!result1.meta.nextCursor) return // Not enough data to test

      // Second page with same filter
      const context2 = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 5,
          cursor: result1.meta.nextCursor,
          filter: { published: true },
        },
      })

      const result2 = await listHandler(context2 as any)

      expect(result2.data.every((p: any) => p.published === true)).toBe(true)
    })
  })

  describe('Cursor with sorting', () => {
    it('should support cursor pagination with sorting', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null,
          sort: '-createdAt', // Descending
        },
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(10)

      // Check sorting is maintained
      const timestamps = result.data.map((p: any) => new Date(p.createdAt).getTime())
      const sorted = [...timestamps].sort((a, b) => b - a)

      expect(timestamps).toEqual(sorted)
    })
  })

  describe('Custom cursor fields', () => {
    it('should support custom cursor fields', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null,
          cursorFields: ['createdAt', 'id'],
        },
      })

      const result = await listHandler(context as any)

      if (result.meta.nextCursor) {
        const decoded = decodeCursor(result.meta.nextCursor)
        expect(decoded).toHaveProperty('createdAt')
        expect(decoded).toHaveProperty('id')
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle empty result set', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null,
          filter: { title: 'Non-existent Post' },
        },
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(0)
      expect(result.meta.hasMore).toBe(false)
      expect(result.meta.nextCursor).toBeUndefined()
    })

    it('should handle single result', async () => {
      // Delete all posts
      await db.delete(baseSchema.posts)

      // Create one post
      await PostFactory.create(db, baseSchema, testData.users[0].id, {
        title: 'Single Post'
      })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null,
        },
      })

      const result = await listHandler(context as any)

      expect(result.data.length).toBe(1)
      expect(result.meta.hasMore).toBe(false)
      expect(result.meta.nextCursor).toBeUndefined()
    })

    it('should handle exact limit match', async () => {
      // Create exactly 10 posts
      await cleanDatabase(db, baseSchema)
      const user = await UserFactory.create(db, baseSchema)

      for (let i = 0; i < 10; i++) {
        await PostFactory.create(db, baseSchema, user.id, {
          title: `Post ${i + 1}`,
        })
      }

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          limit: 10,
          cursor: null,
        },
      })

      const result = await listHandler(context as any)

      expect(result.data.length).toBe(10)
      expect(result.meta.hasMore).toBe(false)
      expect(result.meta.nextCursor).toBeUndefined()
    })
  })
})
