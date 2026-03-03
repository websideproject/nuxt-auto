import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { deleteHandler } from '../../src/runtime/server/handlers/delete'
import { restoreHandler } from '../../src/runtime/server/handlers/restore'
import { createMockContext } from '../helpers/mocks'
import { eq } from 'drizzle-orm'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('Soft Deletes Integration', () => {
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

  describe('Delete with soft delete', () => {
    it('should soft delete a post', async () => {
      const postId = testData.posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: postId.toString() },
        permissions: ['admin'],
      })

      const result = await deleteHandler(context as any)

      expect(result.success).toBe(true)
      expect(result.softDeleted).toBe(true)

      // Verify deletedAt is set
      const [post] = await db.select().from(baseSchema.posts).where(eq(baseSchema.posts.id, postId))
      expect(post.deletedAt).not.toBeNull()
    })

    it('should hard delete when no deletedAt column', async () => {
      // Users table doesn't have deletedAt
      const userId = testData.users[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'delete',
        params: { id: userId.toString() },
        permissions: ['admin'],
      })

      const result = await deleteHandler(context as any)

      expect(result.success).toBe(true)
      expect(result.softDeleted).toBe(false)

      // Verify record is actually deleted
      const [user] = await db.select().from(baseSchema.users).where(eq(baseSchema.users.id, userId))
      expect(user).toBeUndefined()
    })
  })

  describe('List excludes deleted', () => {
    it('should not return soft-deleted posts', async () => {
      const postId = testData.posts[0].id

      // Soft delete a post
      await db.update(baseSchema.posts)
        .set({ deletedAt: new Date() })
        .where(eq(baseSchema.posts.id, postId))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
      })

      const result = await listHandler(context as any)

      expect(result.data.find((p: any) => p.id === postId)).toBeUndefined()
    })

    it('should include deleted posts for admin with includeDeleted', async () => {
      const postId = testData.posts[0].id

      // Soft delete a post
      await db.update(baseSchema.posts)
        .set({ deletedAt: new Date() })
        .where(eq(baseSchema.posts.id, postId))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: { includeDeleted: true },
        permissions: ['admin'],
      })

      const result = await listHandler(context as any)

      expect(result.data.find((p: any) => p.id === postId)).toBeDefined()
    })

    it('should not include deleted posts for non-admin with includeDeleted', async () => {
      const postId = testData.posts[0].id

      // Soft delete a post
      await db.update(baseSchema.posts)
        .set({ deletedAt: new Date() })
        .where(eq(baseSchema.posts.id, postId))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: { includeDeleted: true },
        permissions: ['user'],
      })

      const result = await listHandler(context as any)

      expect(result.data.find((p: any) => p.id === postId)).toBeUndefined()
    })
  })

  describe('Get excludes deleted', () => {
    it('should return 404 for soft-deleted post', async () => {
      const postId = testData.posts[0].id

      // Soft delete a post
      await db.update(baseSchema.posts)
        .set({ deletedAt: new Date() })
        .where(eq(baseSchema.posts.id, postId))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: postId.toString() },
        permissions: ['user'],
      })

      await expect(getHandler(context as any)).rejects.toThrow()
    })

    it('should return soft-deleted post for admin', async () => {
      const postId = testData.posts[0].id

      // Soft delete a post
      await db.update(baseSchema.posts)
        .set({ deletedAt: new Date() })
        .where(eq(baseSchema.posts.id, postId))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: postId.toString() },
        permissions: ['admin'],
      })

      const result = await getHandler(context as any)

      expect(result.data.id).toBe(postId)
      expect(result.data.deletedAt).not.toBeNull()
    })
  })

  describe('Restore', () => {
    it('should restore a soft-deleted post', async () => {
      const postId = testData.posts[0].id

      // Soft delete a post
      await db.update(baseSchema.posts)
        .set({ deletedAt: new Date() })
        .where(eq(baseSchema.posts.id, postId))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: postId.toString() },
        permissions: ['admin'],
      })

      const result = await restoreHandler(context as any)

      expect(result.restored).toBe(true)
      expect(result.data.deletedAt).toBeNull()

      // Verify it appears in list again
      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
      })

      const listResult = await listHandler(listContext as any)
      expect(listResult.data.find((p: any) => p.id === postId)).toBeDefined()
    })

    it('should reject restore for non-admin', async () => {
      const postId = testData.posts[0].id

      // Soft delete a post
      await db.update(baseSchema.posts)
        .set({ deletedAt: new Date() })
        .where(eq(baseSchema.posts.id, postId))

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: postId.toString() },
        permissions: ['user'],
      })

      await expect(restoreHandler(context as any)).rejects.toThrow()
    })

    it('should fail restore on non-soft-delete table', async () => {
      const userId = testData.users[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'update',
        params: { id: userId.toString() },
        permissions: ['admin'],
      })

      await expect(restoreHandler(context as any)).rejects.toThrow()
    })
  })
})
