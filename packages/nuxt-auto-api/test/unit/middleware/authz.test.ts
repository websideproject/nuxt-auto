import { describe, it, expect } from 'vitest'
import { createAuthorizationMiddleware, checkObjectLevelAuth } from '../../../src/runtime/server/middleware/authz'
import { createMockContext, createMockUser } from '../../helpers/mocks'

describe('Authorization Middleware', () => {
  describe('createAuthorizationMiddleware', () => {
    it('should allow request with valid permissions', async () => {
      const config = {
        permissions: {
          read: ['user', 'admin'],
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['user', 'read', 'create'],
        operation: 'list',
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should deny request without required permission', async () => {
      const config = {
        permissions: {
          create: ['admin'],
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['read'],
        operation: 'create',
      })

      await expect(middleware(context as any)).rejects.toThrow('Forbidden')
    })

    it('should require authentication when no user', async () => {
      const config = {
        permissions: {
          read: ['user'],
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: null,
        permissions: [],
        operation: 'list',
      })

      await expect(middleware(context as any)).rejects.toThrow('Authentication required')
    })

    it('should map list operation to read permission', async () => {
      const config = {
        permissions: {
          read: ['user'],
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('user')
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user
        operation: 'list',
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should map get operation to read permission', async () => {
      const config = {
        permissions: {
          read: ['user'],
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('user')
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user
        operation: 'get',
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should set objectLevelCheck flag for get operation', async () => {
      const config = {
        permissions: {
          read: ['user'],
        },
        objectLevel: (obj: any, ctx: any) => {
          return ctx.user.id === obj.userId
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('user', { id: 1 })
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user
        operation: 'get',
      })

      await middleware(context as any)

      expect(context.objectLevelCheck).toBeDefined()
    })

    it('should set objectLevelCheck flag for update operation', async () => {
      const config = {
        permissions: {
          update: ['admin', 'owner'],
        },
        objectLevel: (obj: any, ctx: any) => {
          return ctx.user.id === obj.userId
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user', { id: 2 }),
        permissions: ['update', 'owner'], // User needs 'owner' permission
        operation: 'update',
      })

      await middleware(context as any)

      expect(context.objectLevelCheck).toBeDefined()
    })

    it('denies every operation when the resource declares no authorization (deny by default)', async () => {
      const middleware = createAuthorizationMiddleware()
      await expect(middleware(createMockContext({ user: null, operation: 'create' }) as any)).rejects.toMatchObject({ statusCode: 401 })
      await expect(middleware(createMockContext({ user: createMockUser('user'), operation: 'list' }) as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('denies an operation the config does not mention', async () => {
      const middleware = createAuthorizationMiddleware({ permissions: { read: true } })
      const context = createMockContext({ user: createMockUser('user'), permissions: ['read'], operation: 'create' })
      await expect(middleware(context as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('`true` opens an operation to everyone, including anonymous callers', async () => {
      const middleware = createAuthorizationMiddleware({ permissions: { read: true } })
      await expect(middleware(createMockContext({ user: null, operation: 'list' }) as any)).resolves.toBeUndefined()
    })

    it('`false` closes an operation even to the * wildcard', async () => {
      const middleware = createAuthorizationMiddleware({ permissions: { delete: false } })
      const context = createMockContext({ user: createMockUser('admin'), permissions: ['*'], operation: 'delete' })
      await expect(middleware(context as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('the * wildcard passes string, array and function permissions', async () => {
      const middleware = createAuthorizationMiddleware({ permissions: { update: 'x', delete: () => false, create: ['a'] } })
      for (const operation of ['update', 'delete', 'create'] as const) {
        const context = createMockContext({ user: createMockUser('admin'), permissions: ['*'], operation })
        await expect(middleware(context as any)).resolves.toBeUndefined()
      }
    })

    it('carries listFilter to every operation, not only list', async () => {
      const listFilter = () => undefined
      const middleware = createAuthorizationMiddleware({ permissions: { update: true }, listFilter })
      const context = createMockContext({ user: createMockUser('user'), operation: 'update' }) as any
      await middleware(context)
      expect(context.listFilter).toBe(listFilter)
    })

    it('should support array of required permissions', async () => {
      const config = {
        permissions: {
          update: ['admin', 'editor'],
        },
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('editor')
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user (includes 'editor')
        operation: 'update',
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })
  })

  describe('checkObjectLevelAuth', () => {
    it('should allow access when objectLevelCheck returns true', async () => {
      const context = createMockContext({
        user: createMockUser('user', { id: 1 }),
        objectLevelCheck: (obj: any, ctx: any) => {
          return ctx.user.id === obj.userId
        },
      })

      const object = { userId: 1, title: 'Test' }

      await expect(checkObjectLevelAuth(object, context as any)).resolves.not.toThrow()
    })

    it('should deny access when objectLevelCheck returns false', async () => {
      const context = createMockContext({
        user: createMockUser('user', { id: 2 }),
        objectLevelCheck: (obj: any, ctx: any) => {
          return ctx.user.id === obj.userId
        },
      })

      const object = { userId: 1, title: 'Test' }

      await expect(checkObjectLevelAuth(object, context as any)).rejects.toThrow('Forbidden')
    })

    it('should allow when no objectLevelCheck is set', async () => {
      const context = createMockContext({
        user: createMockUser('user'),
      })

      const object = { userId: 1, title: 'Test' }

      await expect(checkObjectLevelAuth(object, context as any)).resolves.not.toThrow()
    })
  })
})
