import { describe, it, expect, beforeEach } from 'vitest'
import {
  addMiddleware,
  addContextExtender,
  addResourceHook,
  addGlobalHook,
  getMiddlewareForStage,
  getContextExtenders,
  getPluginHooks,
  markInitialized,
  isInitialized,
} from '../../../src/runtime/server/plugins/pluginRegistry'

describe('pluginRegistry', () => {
  beforeEach(() => {
    // Reset the global registry before each test
    globalThis.__autoApiPluginRegistry = undefined
  })

  describe('addMiddleware', () => {
    it('should register a middleware', () => {
      const mw = {
        name: 'test-mw',
        stage: 'pre-auth' as const,
        handler: async () => {},
      }

      addMiddleware(mw)

      const result = getMiddlewareForStage('pre-auth')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('test-mw')
    })

    it('should sort middleware by order', () => {
      addMiddleware({ name: 'c', stage: 'pre-auth', order: 10, handler: async () => {} })
      addMiddleware({ name: 'a', stage: 'pre-auth', order: -5, handler: async () => {} })
      addMiddleware({ name: 'b', stage: 'pre-auth', order: 0, handler: async () => {} })

      const result = getMiddlewareForStage('pre-auth')
      expect(result.map(m => m.name)).toEqual(['a', 'b', 'c'])
    })

    it('should default order to 0 for sorting', () => {
      addMiddleware({ name: 'with-order', stage: 'pre-auth', order: 1, handler: async () => {} })
      addMiddleware({ name: 'no-order', stage: 'pre-auth', handler: async () => {} })

      const result = getMiddlewareForStage('pre-auth')
      expect(result[0].name).toBe('no-order')
      expect(result[1].name).toBe('with-order')
    })
  })

  describe('getMiddlewareForStage', () => {
    beforeEach(() => {
      addMiddleware({ name: 'pre-auth-all', stage: 'pre-auth', handler: async () => {} })
      addMiddleware({ name: 'post-auth-all', stage: 'post-auth', handler: async () => {} })
      addMiddleware({
        name: 'pre-auth-users',
        stage: 'pre-auth',
        resources: ['users'],
        handler: async () => {},
      })
      addMiddleware({
        name: 'pre-auth-create',
        stage: 'pre-auth',
        operations: ['create'],
        handler: async () => {},
      })
    })

    it('should filter by stage', () => {
      const result = getMiddlewareForStage('pre-auth')
      expect(result).toHaveLength(3)
    })

    it('should filter by stage and resource', () => {
      const result = getMiddlewareForStage('pre-auth', 'users')
      expect(result).toHaveLength(3) // all + users-specific + create-any
    })

    it('should exclude middleware for other resources', () => {
      const result = getMiddlewareForStage('pre-auth', 'posts')
      // 'pre-auth-all' (no resource filter) + 'pre-auth-create' (no resource filter)
      expect(result).toHaveLength(2)
      expect(result.map(m => m.name)).not.toContain('pre-auth-users')
    })

    it('should filter by operation', () => {
      const result = getMiddlewareForStage('pre-auth', undefined, 'create')
      expect(result.map(m => m.name)).toContain('pre-auth-create')
    })

    it('should exclude middleware for other operations', () => {
      const result = getMiddlewareForStage('pre-auth', undefined, 'list')
      expect(result.map(m => m.name)).not.toContain('pre-auth-create')
    })

    it('should return empty for unmatched stage', () => {
      const result = getMiddlewareForStage('pre-execute')
      expect(result).toHaveLength(0)
    })
  })

  describe('addContextExtender', () => {
    it('should register a context extender', () => {
      const fn = async () => {}
      addContextExtender(fn)

      const result = getContextExtenders()
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(fn)
    })

    it('should register multiple extenders in order', () => {
      const fn1 = async () => {}
      const fn2 = async () => {}
      addContextExtender(fn1)
      addContextExtender(fn2)

      const result = getContextExtenders()
      expect(result).toHaveLength(2)
      expect(result[0]).toBe(fn1)
      expect(result[1]).toBe(fn2)
    })
  })

  describe('addResourceHook / addGlobalHook', () => {
    it('should register resource-specific hooks', () => {
      const hook = { beforeCreate: async () => {} }
      addResourceHook('users', hook)

      const result = getPluginHooks('users', 'beforeCreate')
      expect(result).toHaveLength(1)
    })

    it('should not return hooks for different resources', () => {
      const hook = { beforeCreate: async () => {} }
      addResourceHook('users', hook)

      const result = getPluginHooks('posts', 'beforeCreate')
      expect(result).toHaveLength(0)
    })

    it('should register global hooks that apply to all resources', () => {
      const hook = { afterCreate: async () => {} }
      addGlobalHook(hook)

      const usersHooks = getPluginHooks('users', 'afterCreate')
      const postsHooks = getPluginHooks('posts', 'afterCreate')
      expect(usersHooks).toHaveLength(1)
      expect(postsHooks).toHaveLength(1)
    })

    it('should combine global and resource-specific hooks', () => {
      addGlobalHook({ beforeCreate: async () => {} })
      addResourceHook('users', { beforeCreate: async () => {} })

      const result = getPluginHooks('users', 'beforeCreate')
      expect(result).toHaveLength(2)
    })

    it('should return empty for hooks that are not functions', () => {
      addGlobalHook({})
      const result = getPluginHooks('users', 'beforeCreate')
      expect(result).toHaveLength(0)
    })
  })

  describe('markInitialized / isInitialized', () => {
    it('should be false by default', () => {
      expect(isInitialized()).toBe(false)
    })

    it('should be true after marking initialized', () => {
      markInitialized()
      expect(isInitialized()).toBe(true)
    })
  })
})
