import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import { schema as baseSchema } from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { updateHandler } from '../../src/runtime/server/handlers/update'
import { deleteHandler } from '../../src/runtime/server/handlers/delete'
import { createAuthorizationMiddleware } from '../../src/runtime/server/middleware/authz'
import { createMockContext, createMockUser } from '../helpers/mocks'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('Authorization & Relations Integration', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)

    // Mock transaction to support async callback
    db.transaction = async (fn: any) => {
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

    // Create additional test data
    await db.insert(baseSchema.comments).values([
      {
        content: 'First comment',
        postId: testData.posts[0].id,
        userId: testData.users[0].id
      },
      {
        content: 'Second comment',
        postId: testData.posts[0].id,
        userId: testData.users[1].id
      }
    ])
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('Authorization - Collection Level', () => {
    it('should allow admin to list posts', async () => {
      const config = {
        permissions: {
          read: ['admin', 'user']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        db,
        schema: baseSchema,
        user: createMockUser('admin'),
        permissions: ['admin', 'read'],
        operation: 'list',
        resource: 'posts',
        query: {}
      })

      await expect(middleware(context as any)).resolves.not.toThrow()

      // Execute the actual list
      const result = await listHandler(context as any)
      expect(result.data).toBeInstanceOf(Array)
    })

    it('should deny regular user from admin-only operation', async () => {
      const config = {
        permissions: {
          delete: ['admin']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['read', 'create'],
        operation: 'delete',
        resource: 'posts'
      })

      await expect(middleware(context as any)).rejects.toThrow('Forbidden')
    })

    it('should require authentication when no user', async () => {
      const config = {
        permissions: {
          read: ['user']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: null,
        permissions: [],
        operation: 'list',
        resource: 'posts'
      })

      await expect(middleware(context as any)).rejects.toThrow('Authentication required')
    })

    it('should allow operation when user has permission from array', async () => {
      const config = {
        permissions: {
          update: ['admin', 'editor']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('editor'),
        permissions: ['read', 'create', 'update', 'editor'],
        operation: 'update',
        resource: 'posts'
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })
  })

  describe('Authorization - Object Level', () => {
    it('should allow owner to update their post', async () => {
      const post = testData.posts[0]
      const owner = testData.users[0]

      const config = {
        permissions: {
          update: ['admin', 'owner']
        },
        objectLevel: (record: any, ctx: any) => {
          return ctx.user.id === record.userId
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        db,
        schema: baseSchema,
        user: createMockUser('user', { id: owner.id }),
        permissions: ['update', 'owner'],
        operation: 'update',
        resource: 'posts',
        params: { id: post.id },
        validated: {
          body: { title: 'Updated by owner' }
        }
      })

      // Run authorization middleware
      await middleware(context as any)

      // The middleware should set objectLevelCheck
      expect(context.objectLevelCheck).toBeDefined()

      // Now run the actual update
      const result = await updateHandler(context as any)

      expect(result.data.title).toBe('Updated by owner')
    })

    it('should deny non-owner from updating post', async () => {
      const post = testData.posts[0]
      const notOwner = testData.users[1]

      const config = {
        permissions: {
          update: ['admin', 'owner']
        },
        objectLevel: (record: any, ctx: any) => {
          return ctx.user.id === record.userId
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        db,
        schema: baseSchema,
        user: createMockUser('user', { id: notOwner.id }),
        permissions: ['update', 'owner'],
        operation: 'update',
        resource: 'posts',
        params: { id: post.id },
        validated: {
          body: { title: 'Attempted update' }
        }
      })

      // Run authorization middleware
      await middleware(context as any)

      // The update handler will check object-level auth
      await expect(updateHandler(context as any)).rejects.toThrow('Forbidden')
    })

    it('should allow admin regardless of ownership', async () => {
      const post = testData.posts[0]

      const config = {
        permissions: {
          update: ['admin']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        db,
        schema: baseSchema,
        user: createMockUser('admin', { id: 999 }), // Different user
        permissions: ['admin', 'update'],
        operation: 'update',
        resource: 'posts',
        params: { id: post.id },
        validated: {
          body: { title: 'Admin update' }
        }
      })

      await middleware(context as any)

      const result = await updateHandler(context as any)
      expect(result.data.title).toBe('Admin update')
    })
  })

  describe('Relations', () => {
    it('should include single relation (author)', async () => {
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
      expect(result.data.author.id).toBe(testData.users[0].id)
      expect(result.data.author.email).toBe(testData.users[0].email)
    })

    it('should include multiple relations', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: post.id },
        query: {
          include: 'author,comments'
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data.author).toBeDefined()
      expect(result.data.comments).toBeDefined()
      expect(result.data.comments).toBeInstanceOf(Array)
      expect(result.data.comments.length).toBeGreaterThan(0)
    })

    it('should include relations in list query', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author,comments'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBeGreaterThan(0)

      const firstPost = result.data[0]
      expect(firstPost.author).toBeDefined()
      expect(firstPost.comments).toBeDefined()
      expect(firstPost.comments).toBeInstanceOf(Array)
    })

    it('should work with relations and filters together', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author',
          filter: { published: true }
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)

      if (result.data.length > 0) {
        result.data.forEach((post: any) => {
          expect(post.published).toBe(true)
          expect(post.author).toBeDefined()
        })
      }
    })

    it('should work with relations and pagination', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author',
          page: 1,
          limit: 1
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].author).toBeDefined()
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(1)
    })

    it('should work with relations and sorting', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author',
          sort: '-createdAt'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        expect(result.data[0].author).toBeDefined()
      }
    })

    it('should include nested comment authors', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: post.id },
        query: {
          include: 'comments.author'
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data.comments).toBeInstanceOf(Array)

      if (result.data.comments.length > 0) {
        const comment = result.data.comments[0]
        expect(comment.author).toBeDefined()
        expect(comment.author.email).toBeDefined()
      }
    })

    it('should handle user with posts and comments relations', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'get',
        params: { id: user.id },
        query: {
          include: 'posts,comments'
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data.posts).toBeInstanceOf(Array)
      expect(result.data.comments).toBeInstanceOf(Array)
      expect(result.data.posts.length).toBeGreaterThan(0)
    })
  })

  describe('Combined - Authorization with Relations', () => {
    it('should enforce auth and include relations', async () => {
      const post = testData.posts[0]

      const config = {
        permissions: {
          read: ['user', 'admin']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        db,
        schema: baseSchema,
        user: createMockUser('user'),
        permissions: ['read', 'user'],
        operation: 'get',
        resource: 'posts',
        params: { id: post.id },
        query: {
          include: 'author,comments'
        }
      })

      // Auth check
      await middleware(context as any)

      // Get with relations
      const result = await getHandler(context as any)

      expect(result.data.author).toBeDefined()
      expect(result.data.comments).toBeDefined()
    })

    it('should deny unauthorized user even with relations requested', async () => {
      const config = {
        permissions: {
          read: ['admin']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['create'], // No read permission
        operation: 'list',
        resource: 'posts',
        query: {
          include: 'author'
        }
      })

      await expect(middleware(context as any)).rejects.toThrow('Forbidden')
    })
  })
})
