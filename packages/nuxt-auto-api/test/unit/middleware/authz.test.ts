import { describe, it, expect } from 'vitest'
import { createAuthorizationMiddleware, checkObjectLevelAuth, filterFieldsByPermission } from '../../../src/runtime/server/middleware/authz'
import { createMockContext, createMockUser } from '../../helpers/mocks'

describe('Authorization Middleware', () => {
  describe('createAuthorizationMiddleware', () => {
    it('should allow request with valid permissions', async () => {
      const config = {
        permissions: {
          read: ['user', 'admin']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['user', 'read', 'create'],
        operation: 'list'
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should deny request without required permission', async () => {
      const config = {
        permissions: {
          create: ['admin']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['read'],
        operation: 'create'
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
        operation: 'list'
      })

      await expect(middleware(context as any)).rejects.toThrow('Authentication required')
    })

    it('should map list operation to read permission', async () => {
      const config = {
        permissions: {
          read: ['user']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('user')
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user
        operation: 'list'
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should map get operation to read permission', async () => {
      const config = {
        permissions: {
          read: ['user']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('user')
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user
        operation: 'get'
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should set objectLevelCheck flag for get operation', async () => {
      const config = {
        permissions: {
          read: ['user']
        },
        objectLevel: (obj: any, ctx: any) => {
          return ctx.user.id === obj.userId
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('user', { id: 1 })
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user
        operation: 'get'
      })

      await middleware(context as any)

      expect(context.objectLevelCheck).toBeDefined()
    })

    it('should set objectLevelCheck flag for update operation', async () => {
      const config = {
        permissions: {
          update: ['admin', 'owner']
        },
        objectLevel: (obj: any, ctx: any) => {
          return ctx.user.id === obj.userId
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user', { id: 2 }),
        permissions: ['update', 'owner'], // User needs 'owner' permission
        operation: 'update'
      })

      await middleware(context as any)

      expect(context.objectLevelCheck).toBeDefined()
    })

    it('should allow all operations when no config', async () => {
      const middleware = createAuthorizationMiddleware()
      const context = createMockContext({
        user: null,
        permissions: [],
        operation: 'create'
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should allow operation when no permission required', async () => {
      const config = {
        permissions: {}
      }

      const middleware = createAuthorizationMiddleware(config)
      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['read'],
        operation: 'create'
      })

      await expect(middleware(context as any)).resolves.not.toThrow()
    })

    it('should support array of required permissions', async () => {
      const config = {
        permissions: {
          update: ['admin', 'editor']
        }
      }

      const middleware = createAuthorizationMiddleware(config)
      const mockUser = createMockUser('editor')
      const context = createMockContext({
        user: mockUser,
        permissions: mockUser.permissions, // Use permissions from mock user (includes 'editor')
        operation: 'update'
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
        }
      })

      const object = { userId: 1, title: 'Test' }

      await expect(checkObjectLevelAuth(object, context as any)).resolves.not.toThrow()
    })

    it('should deny access when objectLevelCheck returns false', async () => {
      const context = createMockContext({
        user: createMockUser('user', { id: 2 }),
        objectLevelCheck: (obj: any, ctx: any) => {
          return ctx.user.id === obj.userId
        }
      })

      const object = { userId: 1, title: 'Test' }

      await expect(checkObjectLevelAuth(object, context as any)).rejects.toThrow('Forbidden')
    })

    it('should allow when no objectLevelCheck is set', async () => {
      const context = createMockContext({
        user: createMockUser('user')
      })

      const object = { userId: 1, title: 'Test' }

      await expect(checkObjectLevelAuth(object, context as any)).resolves.not.toThrow()
    })
  })

  describe('filterFieldsByPermission', () => {
    it('should filter fields based on read permissions', () => {
      const config = {
        fields: {
          email: {
            read: ['admin']
          },
          password: {
            read: ['admin']
          }
        }
      }

      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['read']
      })

      const data = {
        id: 1,
        name: 'John',
        email: 'john@test.com',
        password: 'secret'
      }

      const result = filterFieldsByPermission(data, config as any, context as any)

      expect(result).toEqual({
        id: 1,
        name: 'John'
      })
    })

    it('should include fields when user has required permission', () => {
      const config = {
        fields: {
          email: {
            read: ['admin', 'user']
          }
        }
      }

      const context = createMockContext({
        user: createMockUser('user'),
        permissions: ['read', 'user']
      })

      const data = {
        id: 1,
        email: 'john@test.com'
      }

      const result = filterFieldsByPermission(data, config as any, context as any)

      expect(result).toEqual({
        id: 1,
        email: 'john@test.com'
      })
    })

    it('should return all fields when no config', () => {
      const context = createMockContext({
        user: createMockUser('user')
      })

      const data = {
        id: 1,
        name: 'John',
        email: 'john@test.com'
      }

      const result = filterFieldsByPermission(data, undefined, context as any)

      expect(result).toEqual(data)
    })

    it('should return all fields when no context', () => {
      const data = {
        id: 1,
        name: 'John'
      }

      const result = filterFieldsByPermission(data, {} as any, undefined)

      expect(result).toEqual(data)
    })
  })
})
