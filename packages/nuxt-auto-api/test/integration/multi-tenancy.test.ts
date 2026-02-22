import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, cleanDatabase } from '../helpers/setup'
import { UserFactory, PostFactory } from '../helpers/factories'
import * as baseSchema from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { createHandler } from '../../src/runtime/server/handlers/create'
import { updateHandler } from '../../src/runtime/server/handlers/update'
import { deleteHandler } from '../../src/runtime/server/handlers/delete'
import { createMockContext } from '../helpers/mocks'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('Multi-Tenancy Integration', () => {
  let db: any
  let sqlite: any
  let org1User: any
  let org2User: any
  let org1Posts: any[]
  let org2Posts: any[]

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite

    // Create users in different organizations
    org1User = await UserFactory.create(db, baseSchema, { organizationId: '1' })
    org2User = await UserFactory.create(db, baseSchema, { organizationId: '2' })

    // Create posts for each organization
    org1Posts = []
    org2Posts = []

    for (let i = 0; i < 3; i++) {
      const post = await PostFactory.create(db, baseSchema, org1User.id, {
        title: `Org 1 Post ${i + 1}`,
        organizationId: '1',
      })
      org1Posts.push(post)
    }

    for (let i = 0; i < 3; i++) {
      const post = await PostFactory.create(db, baseSchema, org2User.id, {
        title: `Org 2 Post ${i + 1}`,
        organizationId: '2',
      })
      org2Posts.push(post)
    }
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('List scoping', () => {
    it('should only return posts from user organization', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
      })

      const result = await listHandler(context as any)

      expect(result.data.length).toBe(3)
      expect(result.data.every((p: any) => p.organizationId === '1')).toBe(true)
    })

    it('should return all posts for cross-tenant admin', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
        user: { id: org1User.id, organizationId: '1', role: 'superadmin' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: true,
        },
      })

      const result = await listHandler(context as any)

      expect(result.data.length).toBe(6)
      const org1Count = result.data.filter((p: any) => p.organizationId === '1').length
      const org2Count = result.data.filter((p: any) => p.organizationId === '2').length
      expect(org1Count).toBe(3)
      expect(org2Count).toBe(3)
    })
  })

  describe('Get scoping', () => {
    it('should allow access to own organization post', async () => {
      const postId = org1Posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: postId.toString() },
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
      })

      const result = await getHandler(context as any)

      expect(result.data.id).toBe(postId)
      expect(result.data.organizationId).toBe('1')
    })

    it('should deny access to other organization post', async () => {
      const postId = org2Posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: postId.toString() },
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
      })

      await expect(getHandler(context as any)).rejects.toThrow()
    })

    it('should allow cross-tenant admin to access any post', async () => {
      const postId = org2Posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: postId.toString() },
        user: { id: org1User.id, organizationId: '1', role: 'superadmin' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: true,
        },
      })

      const result = await getHandler(context as any)

      expect(result.data.id).toBe(postId)
      expect(result.data.organizationId).toBe('2')
    })
  })

  describe('Create with auto-scoping', () => {
    it('should automatically set organizationId on create', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
        validated: {
          body: {
            title: 'New Post',
            userId: org1User.id,
          },
        },
      })

      const result = await createHandler(context as any)

      expect(result.data.organizationId).toBe('1')
      expect(result.data.title).toBe('New Post')
    })

    it('should override explicit organizationId with tenant', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'create',
        query: {},
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
        validated: {
          body: {
            title: 'New Post',
            userId: org1User.id,
            organizationId: '2', // Try to set different org
          },
        },
      })

      const result = await createHandler(context as any)

      // Should be set to user's org, not the attempted org
      expect(result.data.organizationId).toBe('1')
    })
  })

  describe('Update with scoping', () => {
    it('should allow update of own organization post', async () => {
      const postId = org1Posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: postId.toString() },
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
        validated: {
          body: {
            title: 'Updated Title',
          },
        },
      })

      const result = await updateHandler(context as any)

      expect(result.data.title).toBe('Updated Title')
      expect(result.data.organizationId).toBe('1')
    })

    it('should deny update of other organization post', async () => {
      const postId = org2Posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'update',
        params: { id: postId.toString() },
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
        validated: {
          body: {
            title: 'Updated Title',
          },
        },
      })

      await expect(updateHandler(context as any)).rejects.toThrow()
    })
  })

  describe('Delete with scoping', () => {
    it('should allow delete of own organization post', async () => {
      const postId = org1Posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: postId.toString() },
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
      })

      const result = await deleteHandler(context as any)

      expect(result.success).toBe(true)
    })

    it('should deny delete of other organization post', async () => {
      const postId = org2Posts[0].id

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'delete',
        params: { id: postId.toString() },
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
      })

      await expect(deleteHandler(context as any)).rejects.toThrow()
    })
  })

  describe('Edge cases', () => {
    it('should handle missing tenant context gracefully', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
        user: { id: org1User.id },
        tenant: undefined, // No tenant context
      })

      const result = await listHandler(context as any)

      // Should return all posts when no tenant scoping
      expect(result.data.length).toBe(6)
    })

    it('should handle null organizationId', async () => {
      // Create post without organizationId
      const post = await PostFactory.create(db, baseSchema, org1User.id, {
        title: 'Global Post',
        organizationId: null,
      })

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {},
        user: { id: org1User.id, organizationId: '1' },
        tenant: {
          id: '1',
          field: 'organizationId',
          canAccessAllTenants: false,
        },
      })

      const result = await listHandler(context as any)

      // Should not include null org post
      expect(result.data.find((p: any) => p.id === post.id)).toBeUndefined()
    })
  })
})
