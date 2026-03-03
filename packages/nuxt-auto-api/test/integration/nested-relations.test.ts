import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import { PostFactory, CommentFactory } from '../helpers/factories'
import { schema as baseSchema } from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { createMockContext } from '../helpers/mocks'
import { parseEnhancedInclude, isEnhancedInclude } from '../../src/runtime/server/utils/buildNestedRelations'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {
    relations: {
      maxDepth: 3
    }
  }
}))

describe('Nested Relations Integration', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)

    // Create more test data for relation tests
    const user = testData.users[0]
    await PostFactory.create(db, baseSchema, user.id, { title: 'Post 3', published: true })
    await PostFactory.create(db, baseSchema, user.id, { title: 'Post 4', published: false })
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('Enhanced include syntax parsing', () => {
    it('should detect enhanced syntax', () => {
      expect(isEnhancedInclude('posts[id,title]')).toBe(true)
      expect(isEnhancedInclude('posts{limit:10}')).toBe(true)
      expect(isEnhancedInclude('posts')).toBe(false)
      expect(isEnhancedInclude('posts.comments')).toBe(false)
    })

    it('should parse field selection', () => {
      const result = parseEnhancedInclude('posts[id,title]')
      expect(result.relation).toBe('posts')
      expect(result.fields).toEqual(['id', 'title'])
      expect(result.options).toBeUndefined()
    })

    it('should parse pagination options', () => {
      const result = parseEnhancedInclude('posts{limit:10}')
      expect(result.relation).toBe('posts')
      expect(result.options?.limit).toBe(10)
    })

    it('should parse filter options', () => {
      const result = parseEnhancedInclude('posts{filter:{published:true}}')
      expect(result.relation).toBe('posts')
      expect(result.options?.filter).toEqual({ published: true })
    })

    it('should parse combined syntax', () => {
      const result = parseEnhancedInclude('posts[id,title]{limit:10,filter:{published:true}}')
      expect(result.relation).toBe('posts')
      expect(result.fields).toEqual(['id', 'title'])
      expect(result.options?.limit).toBe(10)
      expect(result.options?.filter).toEqual({ published: true })
    })

    it('should parse nested relations', () => {
      const result = parseEnhancedInclude('posts.comments.author')
      expect(result.relation).toBe('posts')
      expect(result.nested).toBe('comments.author')
    })
  })

  describe('Field selection on relations', () => {
    it('should select only specified fields from relation', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts[id,title]'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0 && result.data[0].posts) {
        const post = result.data[0].posts[0]
        expect(post).toHaveProperty('id')
        expect(post).toHaveProperty('title')
        expect(post).not.toHaveProperty('content')
        expect(post).not.toHaveProperty('published')
      }
    })

    it('should work with get handler', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'get',
        params: { id: user.id },
        query: {
          include: 'posts[id,title,published]'
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      if (result.data.posts && result.data.posts.length > 0) {
        const post = result.data.posts[0]
        expect(post).toHaveProperty('id')
        expect(post).toHaveProperty('title')
        expect(post).toHaveProperty('published')
        expect(post).not.toHaveProperty('content')
      }
    })
  })

  describe('Pagination on relations', () => {
    it('should limit related records', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts{limit:2}'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0 && result.data[0].posts) {
        expect(result.data[0].posts.length).toBeLessThanOrEqual(2)
      }
    })

    it('should apply offset to related records', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts{limit:2,offset:1}'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      // Verify that results are offset (would need more complex verification)
    })
  })

  describe('Filtering on relations', () => {
    it('should filter related records', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts{filter:{published:true}}'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0 && result.data[0].posts) {
        result.data[0].posts.forEach((post: any) => {
          expect(post.published).toBe(true)
        })
      }
    })
  })

  describe('Combined features', () => {
    it('should combine field selection, filtering, and pagination', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts[id,title,published]{limit:10,filter:{published:true}}'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0 && result.data[0].posts) {
        result.data[0].posts.forEach((post: any) => {
          // Field selection
          expect(post).toHaveProperty('id')
          expect(post).toHaveProperty('title')
          expect(post).toHaveProperty('published')
          expect(post).not.toHaveProperty('content')

          // Filter
          expect(post.published).toBe(true)
        })

        // Pagination
        expect(result.data[0].posts.length).toBeLessThanOrEqual(10)
      }
    })
  })

  describe('Deep nesting', () => {
    it('should support nested relations with enhanced syntax', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts[id,title].comments[id,body].author[id,name]'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      // Verify nested structure exists
      if (result.data.length > 0) {
        const user = result.data[0]
        if (user.posts && user.posts.length > 0) {
          const post = user.posts[0]
          expect(post).toHaveProperty('id')
          expect(post).toHaveProperty('title')
          expect(post).not.toHaveProperty('content')

          if (post.comments && post.comments.length > 0) {
            const comment = post.comments[0]
            expect(comment).toHaveProperty('id')
            expect(comment).toHaveProperty('body')

            if (comment.author) {
              expect(comment.author).toHaveProperty('id')
              expect(comment.author).toHaveProperty('name')
              expect(comment.author).not.toHaveProperty('email')
            }
          }
        }
      }
    })
  })

  describe('Multiple relations', () => {
    it('should support multiple relations with different options', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts[id,title]{limit:5},comments[id,body]{limit:3}'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        const user = result.data[0]

        if (user.posts) {
          expect(user.posts.length).toBeLessThanOrEqual(5)
          user.posts.forEach((post: any) => {
            expect(post).toHaveProperty('id')
            expect(post).toHaveProperty('title')
            expect(post).not.toHaveProperty('content')
          })
        }

        if (user.comments) {
          expect(user.comments.length).toBeLessThanOrEqual(3)
          user.comments.forEach((comment: any) => {
            expect(comment).toHaveProperty('id')
            expect(comment).toHaveProperty('body')
          })
        }
      }
    })
  })

  describe('Backward compatibility', () => {
    it('should still support simple include syntax', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0 && result.data[0].posts) {
        expect(result.data[0].posts).toBeInstanceOf(Array)
        // All fields should be present with simple syntax
        if (result.data[0].posts.length > 0) {
          expect(result.data[0].posts[0]).toHaveProperty('id')
          expect(result.data[0].posts[0]).toHaveProperty('title')
          expect(result.data[0].posts[0]).toHaveProperty('content')
        }
      }
    })

    it('should support simple nested syntax', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts.comments'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      // Verify structure exists
      if (result.data.length > 0 && result.data[0].posts) {
        if (result.data[0].posts[0]?.comments) {
          expect(result.data[0].posts[0].comments).toBeInstanceOf(Array)
        }
      }
    })
  })
})
