import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import { UserFactory, PostFactory } from '../helpers/factories'
import * as baseSchema from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { createHandler } from '../../src/runtime/server/handlers/create'
import { updateHandler } from '../../src/runtime/server/handlers/update'
import { deleteHandler } from '../../src/runtime/server/handlers/delete'
import { createMockContext, createMockUser } from '../helpers/mocks'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('CRUD Operations Integration', () => {
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

  describe('List Handler', () => {
    it('should return all posts', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {}
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.meta).toBeDefined()
      expect(result.meta.limit).toBe(20) // default limit
    })

    it('should filter posts by published status', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          filter: { published: true }
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.every((p: any) => p.published === true)).toBe(true)
    })

    it('should include relations when requested', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('author')
        expect(result.data[0].author).toBeDefined()
        expect(result.data[0].author).toHaveProperty('email')
      }
    })

    it('should paginate results', async () => {
      // Create more posts
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'Post 3' })
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'Post 4' })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          page: 1,
          limit: 2
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toHaveLength(2)
      expect(result.meta.limit).toBe(2)
      expect(result.meta.page).toBe(1)
      expect(result.meta.total).toBeGreaterThanOrEqual(2)
    })

    it('should sort results by field', async () => {
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'AAA Post' })
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'ZZZ Post' })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          sort: 'title'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data.length).toBeGreaterThan(0)
      // First post should come alphabetically before last
      const firstTitle = result.data[0].title
      const lastTitle = result.data[result.data.length - 1].title
      expect(firstTitle <= lastTitle).toBe(true)
    })

    it('should sort descending with - prefix', async () => {
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'AAA Post' })
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'ZZZ Post' })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          sort: '-title'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data.length).toBeGreaterThan(0)
      // First post should come alphabetically after last (descending)
      const firstTitle = result.data[0].title
      const lastTitle = result.data[result.data.length - 1].title
      expect(firstTitle >= lastTitle).toBe(true)
    })

    it('should filter fields when requested', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          fields: 'id,title'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('id')
        expect(result.data[0]).toHaveProperty('title')
        expect(result.data[0]).not.toHaveProperty('content')
      }
    })

    it('should handle complex filters with operators', async () => {
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'Test 1', published: true })
      await PostFactory.create(db, baseSchema, testData.users[0].id, { title: 'Test 2', published: true })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          filter: {
            title: { $like: 'Test' },
            published: true
          }
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data.every((p: any) => p.published === true)).toBe(true)
    })
  })

  describe('Get Handler', () => {
    it('should return single post by ID', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: post.id }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data.id).toBe(post.id)
      expect(result.data.title).toBe(post.title)
    })

    it('should throw 404 for non-existent post', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: 99999 }
      })

      await expect(getHandler(context as any)).rejects.toThrow('not found')
    })

    it('should include relations when requested', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: post.id },
        query: {
          include: 'author'
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data.author).toBeDefined()
      expect(result.data.author.email).toBe(testData.users[0].email)
    })

    it('should filter fields when requested', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: post.id },
        query: {
          fields: 'id,title'
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toHaveProperty('id')
      expect(result.data).toHaveProperty('title')
      expect(result.data).not.toHaveProperty('content')
    })
  })

  describe('Create Handler', () => {
    it('should create new post', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        user: createMockUser('admin'),
        validated: {
          body: {
            title: 'New Post',
            content: 'New content',
            userId: user.id,
            published: false
          }
        }
      })

      const result = await createHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data.title).toBe('New Post')
      expect(result.data.content).toBe('New content')
      expect(result.data.id).toBeDefined()

      // Verify it was actually created in DB
      const check = await db.query.posts.findFirst({
        where: (posts: any, { eq }: any) => eq(posts.id, result.data.id)
      })
      expect(check).toBeDefined()
      expect(check.title).toBe('New Post')
    })

    it('should create post with minimal fields', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        validated: {
          body: {
            title: 'Minimal Post',
            userId: user.id
          }
        }
      })

      const result = await createHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data.title).toBe('Minimal Post')
      expect(result.data.published).toBe(false) // default value
    })

    it('should throw error for invalid body', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        event: {} as any
      })

      // Mock readBody to return null
      await expect(createHandler(context as any)).rejects.toThrow()
    })
  })

  describe('Update Handler', () => {
    it('should update existing post', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: post.id },
        user: createMockUser('admin'),
        validated: {
          body: {
            title: 'Updated Title'
          }
        }
      })

      const result = await updateHandler(context as any)

      expect(result.data.title).toBe('Updated Title')
      expect(result.data.id).toBe(post.id)

      // Verify update persisted
      const check = await db.query.posts.findFirst({
        where: (posts: any, { eq }: any) => eq(posts.id, post.id)
      })
      expect(check.title).toBe('Updated Title')
    })

    it('should update multiple fields', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: post.id },
        validated: {
          body: {
            title: 'New Title',
            content: 'New Content',
            published: true
          }
        }
      })

      const result = await updateHandler(context as any)

      expect(result.data.title).toBe('New Title')
      expect(result.data.content).toBe('New Content')
      expect(result.data.published).toBe(true)
    })

    it('should throw 404 for non-existent post', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: 99999 },
        validated: { body: { title: 'Test' } }
      })

      await expect(updateHandler(context as any)).rejects.toThrow('not found')
    })
  })

  describe('Delete Handler', () => {
    it('should delete existing post', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: post.id },
        user: createMockUser('admin')
      })

      const result = await deleteHandler(context as any)

      expect(result.success).toBe(true)

      // Verify deleted (soft delete)
      const check = await db.query.posts.findFirst({
        where: (posts: any, { eq }: any) => eq(posts.id, post.id)
      })
      expect(check).toBeDefined()
      expect(check.deletedAt).not.toBeNull()
    })

    it('should throw 404 for non-existent post', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: 99999 },
        user: createMockUser('admin')
      })

      await expect(deleteHandler(context as any)).rejects.toThrow('not found')
    })

    it('should not find deleted post in subsequent queries', async () => {
      const post = testData.posts[0]

      // Delete
      const deleteContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: post.id },
        user: createMockUser('admin')
      })

      await deleteHandler(deleteContext as any)

      // Try to get
      const getContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: post.id }
      })

      await expect(getHandler(getContext as any)).rejects.toThrow('not found')
    })
  })
})
