import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface CachePluginOptions {
  /** Cache TTL in milliseconds. @default 60000 */
  ttlMs?: number
  /** Maximum number of cached entries. @default 1000 */
  maxEntries?: number
  /** Resources to cache (undefined = all). */
  resources?: string[]
  /** Operations to cache. @default ['list', 'get'] */
  operations?: ('list' | 'get')[]
  /** Custom cache key generator */
  keyGenerator?: (ctx: any) => string
  /** Operations that invalidate cache. @default ['create', 'update', 'delete'] */
  invalidateOn?: ('create' | 'update' | 'delete')[]
}

interface CacheEntry {
  data: any
  expiresAt: number
}

/**
 * Create a caching plugin.
 * Caches list/get responses in memory and invalidates on mutations.
 *
 * @example
 * ```ts
 * createCachePlugin({
 *   ttlMs: 30000,
 *   maxEntries: 500,
 *   resources: ['articles', 'categories'],
 * })
 * ```
 */
export function createCachePlugin(options: CachePluginOptions = {}): AutoApiPlugin {
  const {
    ttlMs = 60000,
    maxEntries = 1000,
    resources,
    operations = ['list', 'get'],
    keyGenerator,
    invalidateOn = ['create', 'update', 'delete'],
  } = options

  const cache = new Map<string, CacheEntry>()
  let cleanupTimer: ReturnType<typeof setInterval> | null = null

  function shouldCache(resource: string): boolean {
    if (!resources) return true
    return resources.includes(resource)
  }

  function generateKey(context: any): string {
    if (keyGenerator) return keyGenerator(context)

    const parts = [
      context.resource,
      context.operation,
      JSON.stringify(context.query || {}),
      context.params?.id || '',
      context.user?.id || 'anon',
      context.tenant?.id || '',
    ]
    return parts.join(':')
  }

  function evictIfNeeded() {
    if (cache.size <= maxEntries) return
    // Remove oldest entries
    const entries = [...cache.entries()]
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    const toRemove = entries.slice(0, entries.length - maxEntries)
    for (const [key] of toRemove) {
      cache.delete(key)
    }
  }

  function invalidateResource(resource: string) {
    for (const key of cache.keys()) {
      if (key.startsWith(resource + ':')) {
        cache.delete(key)
      }
    }
  }

  return defineAutoApiPlugin({
    name: 'cache',
    version: '1.0.0',
    runtimeSetup(ctx) {
      // Periodic cleanup of expired entries
      cleanupTimer = setInterval(() => {
        const now = Date.now()
        for (const [key, entry] of cache.entries()) {
          if (now > entry.expiresAt) {
            cache.delete(key)
          }
        }
      }, Math.max(ttlMs, 30000))

      if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
        cleanupTimer.unref()
      }

      // Pre-execute middleware: serve from cache
      ctx.addMiddleware({
        name: 'cache-read',
        stage: 'pre-execute',
        order: -50,
        operations: operations as any[],
        handler: (context) => {
          if (!shouldCache(context.resource)) return

          const key = generateKey(context)
          const entry = cache.get(key)

          if (entry && Date.now() < entry.expiresAt) {
            context.shortCircuit = { data: entry.data }
          }
        },
      })

      // Post-execute middleware: store in cache
      ctx.addMiddleware({
        name: 'cache-write',
        stage: 'post-execute',
        order: 50,
        operations: operations as any[],
        handler: (context) => {
          if (!shouldCache(context.resource)) return
          // Don't cache if we served from cache (shortCircuit was set)
          if (context.shortCircuit) return

          // We don't have the response in middleware context,
          // so we use a flag to mark this request for caching in after hooks
          ;(context as any)._cacheKey = generateKey(context)
        },
      })

      // After hooks: cache the results and handle invalidation
      const cacheableOps = operations

      if (cacheableOps.includes('list')) {
        ctx.addGlobalHook({
          afterList(results, context) {
            if (!shouldCache(context.resource)) return
            const key = (context as any)._cacheKey || generateKey(context)
            // Store the full response
            cache.set(key, {
              data: { data: results, meta: {} },
              expiresAt: Date.now() + ttlMs,
            })
            evictIfNeeded()
          },
        })
      }

      if (cacheableOps.includes('get')) {
        ctx.addGlobalHook({
          afterGet(result, context) {
            if (!shouldCache(context.resource)) return
            const key = (context as any)._cacheKey || generateKey(context)
            cache.set(key, {
              data: { data: result },
              expiresAt: Date.now() + ttlMs,
            })
            evictIfNeeded()
          },
        })
      }

      // Invalidation hooks
      const invalidationHooks: any = {}

      if (invalidateOn.includes('create')) {
        invalidationHooks.afterCreate = (_result: any, context: any) => {
          invalidateResource(context.resource)
        }
      }
      if (invalidateOn.includes('update')) {
        invalidationHooks.afterUpdate = (_result: any, context: any) => {
          invalidateResource(context.resource)
        }
      }
      if (invalidateOn.includes('delete')) {
        invalidationHooks.afterDelete = (_id: any, context: any) => {
          invalidateResource(context.resource)
        }
      }

      if (Object.keys(invalidationHooks).length > 0) {
        ctx.addGlobalHook(invalidationHooks)
      }

      ctx.logger.info(`Cache enabled: TTL ${ttlMs}ms, max ${maxEntries} entries`)
    },
  })
}
