import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { createHandler } from '../../src/runtime/server/handlers/create'
import { updateHandler } from '../../src/runtime/server/handlers/update'
import { createMockContext } from '../helpers/mocks'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('Hidden Fields Integration', () => {
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

  describe('Hidden fields from registry', () => {
    it('should hide password field from user list', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {},
        resourceConfig: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password', 'apiKey']
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        expect(result.data[0]).not.toHaveProperty('password')
        expect(result.data[0]).not.toHaveProperty('apiKey')
        expect(result.data[0]).toHaveProperty('email')
        expect(result.data[0]).toHaveProperty('name')
      }
    })

    it('should hide password field from single user get', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'get',
        params: { id: user.id },
        query: {},
        resourceConfig: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password']
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data).not.toHaveProperty('password')
      expect(result.data).toHaveProperty('email')
      expect(result.data.id).toBe(user.id)
    })

    it('should hide fields from create response', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'create',
        query: {},
        validated: {
          body: {
            email: 'test@example.com',
            name: 'Test User',
            password: 'secret123'
          }
        },
        resourceConfig: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password']
        }
      })

      const result = await createHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data).not.toHaveProperty('password')
      expect(result.data).toHaveProperty('email')
      expect(result.data.email).toBe('test@example.com')
    })

    it('should hide fields from update response', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'update',
        params: { id: user.id },
        query: {},
        validated: {
          body: {
            name: 'Updated Name'
          }
        },
        resourceConfig: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password']
        }
      })

      const result = await updateHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data).not.toHaveProperty('password')
      expect(result.data.name).toBe('Updated Name')
    })
  })

  describe('Hidden fields in nested relations', () => {
    it('should hide password and apiKey from nested author in posts', async () => {
      // Create a full registry with multiple resources
      const registry = {
        users: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password', 'apiKey'] // Users resource config
        },
        posts: {
          name: 'posts',
          schema: baseSchema.posts,
          hiddenFields: [] // Posts resource has no hidden fields
        }
      }

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author'
        },
        resourceConfig: registry.posts,
        registry // Include full registry
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBeGreaterThan(0)

      // Check first post with author
      const postWithAuthor = result.data.find((p: any) => p.author)
      expect(postWithAuthor).toBeDefined()
      expect(postWithAuthor.author).toBeDefined()

      // CRITICAL: Author's hidden fields must be filtered even though we're querying posts
      expect(postWithAuthor.author).not.toHaveProperty('password')
      expect(postWithAuthor.author).not.toHaveProperty('apiKey')

      // But other author fields should be present
      expect(postWithAuthor.author).toHaveProperty('email')
      expect(postWithAuthor.author).toHaveProperty('name')
      expect(postWithAuthor.author).toHaveProperty('id')
    })

    it('should hide fields from deeply nested relations', async () => {
      // Registry with all resources having their own hidden fields
      const registry = {
        users: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password', 'apiKey']
        },
        posts: {
          name: 'posts',
          schema: baseSchema.posts,
          hiddenFields: []
        },
        comments: {
          name: 'comments',
          schema: baseSchema.comments,
          hiddenFields: []
        }
      }

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts.comments.author'
        },
        resourceConfig: registry.users,
        registry
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)

      // Verify hidden fields are removed at all nesting levels
      result.data.forEach((user: any) => {
        // Top level user should have password/apiKey hidden
        expect(user).not.toHaveProperty('password')
        expect(user).not.toHaveProperty('apiKey')

        if (user.posts) {
          user.posts.forEach((post: any) => {
            if (post.comments) {
              post.comments.forEach((comment: any) => {
                // Deeply nested author (also a user) should have password/apiKey hidden
                if (comment.author) {
                  expect(comment.author).not.toHaveProperty('password')
                  expect(comment.author).not.toHaveProperty('apiKey')
                  expect(comment.author).toHaveProperty('email')
                  expect(comment.author).toHaveProperty('name')
                }
              })
            }
          })
        }
      })
    })

    it('should hide fields in array of nested relations', async () => {
      const registry = {
        users: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password', 'apiKey']
        },
        posts: {
          name: 'posts',
          schema: baseSchema.posts,
          hiddenFields: []
        }
      }

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts'
        },
        resourceConfig: registry.users,
        registry
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)

      result.data.forEach((user: any) => {
        // User should have hidden fields filtered
        expect(user).not.toHaveProperty('password')
        expect(user).not.toHaveProperty('apiKey')

        // Posts array should be present
        if (user.posts && Array.isArray(user.posts)) {
          user.posts.forEach((post: any) => {
            // Posts have no hidden fields, so all should be present
            expect(post).toHaveProperty('id')
            expect(post).toHaveProperty('title')
            expect(post).toHaveProperty('content')
          })
        }
      })
    })

    it('should hide fields when single resource returned with nested relation', async () => {
      const user = testData.users[0]

      const registry = {
        users: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password', 'apiKey']
        },
        posts: {
          name: 'posts',
          schema: baseSchema.posts,
          hiddenFields: []
        }
      }

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'get',
        params: { id: user.id },
        query: {
          include: 'posts'
        },
        resourceConfig: registry.users,
        registry
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()

      // Single user should have password/apiKey hidden
      expect(result.data).not.toHaveProperty('password')
      expect(result.data).not.toHaveProperty('apiKey')
      expect(result.data).toHaveProperty('email')

      // Nested posts should be present
      if (result.data.posts) {
        expect(Array.isArray(result.data.posts)).toBe(true)
      }
    })
  })

  describe('Multiple hidden fields', () => {
    it('should hide multiple fields at once', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {},
        resourceConfig: {
          name: 'users',
          schema: baseSchema.users,
          hiddenFields: ['password', 'resetToken', 'apiKey', 'twoFactorSecret']
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        expect(result.data[0]).not.toHaveProperty('password')
        expect(result.data[0]).not.toHaveProperty('resetToken')
        expect(result.data[0]).not.toHaveProperty('apiKey')
        expect(result.data[0]).not.toHaveProperty('twoFactorSecret')
        expect(result.data[0]).toHaveProperty('email')
      }
    })
  })

  describe('No hidden fields configured', () => {
    it('should return all fields when no hidden fields configured', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
        resourceConfig: {
          name: 'posts',
          schema: baseSchema.posts,
          hiddenFields: undefined
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        // All post fields should be present
        expect(result.data[0]).toHaveProperty('id')
        expect(result.data[0]).toHaveProperty('title')
        expect(result.data[0]).toHaveProperty('content')
        expect(result.data[0]).toHaveProperty('published')
      }
    })
  })
})
