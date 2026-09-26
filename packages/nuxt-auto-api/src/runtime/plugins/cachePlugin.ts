import { pluginFromFactory } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

/**
 * Pluggable backing store for cached responses.
 *
 * Default is in-process memory (`InMemoryCacheStore`) — per-isolate, so on Cloudflare
 * Workers the hit-rate is poor and invalidation in one isolate doesn't reach others.
 * Supply a shared store (Cloudflare KV, Redis) via `CachePluginOptions.store` there.
 */
export interface CacheStore {
  get: (key: string) => Promise<any | undefined>
  set: (key: string, value: any, ttlMs: number) => Promise<void>
  /** Invalidate every entry whose key starts with `prefix` (e.g. "articles:"). */
  deleteByPrefix: (prefix: string) => Promise<void>
}

export interface CachePluginOptions {
  /** Cache TTL in milliseconds. @default 60000 */
  ttlMs?: number
  /** Maximum number of cached entries (in-memory store only). @default 1000 */
  maxEntries?: number
  /** Resources to cache (undefined = all). */
  resources?: string[]
  /** Operations to cache. @default ['list', 'get'] */
  operations?: ('list' | 'get')[]
  /** Custom cache key generator */
  keyGenerator?: (ctx: any) => string
  /** Operations that invalidate cache. @default ['create', 'update', 'delete'] */
  invalidateOn?: ('create' | 'update' | 'delete')[]
  /**
   * Backing store. @default new InMemoryCacheStore({ maxEntries, ttlMs })
   * On Cloudflare Workers / multi-isolate runtimes, pass a shared store (KV).
   */
  store?: CacheStore
}

interface CacheEntry {
  data: any
  expiresAt: number
}

/**
 * Default in-process cache store. Identical semantics to the previous inline `Map`:
 * TTL expiry, max-entries eviction (oldest-first), periodic cleanup, prefix invalidation.
 */
export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, CacheEntry>()

  constructor(private opts: { maxEntries: number, cleanupMs: number }) {
    // No periodic timer: Cloudflare Workers disallow setInterval/setTimeout in global scope, and
    // this store can be constructed at plugin-setup (isolate init). Expiry is lazy in get(); stale
    // entries are also swept in evictIfNeeded() when the store fills. (opts.cleanupMs is unused.)
  }

  async get(key: string): Promise<any | undefined> {
    const entry = this.cache.get(key)
    if (entry && Date.now() < entry.expiresAt) return entry.data
    if (entry) this.cache.delete(key)
    return undefined
  }

  async set(key: string, value: any, ttlMs: number): Promise<void> {
    this.cache.set(key, { data: value, expiresAt: Date.now() + ttlMs })
    this.evictIfNeeded()
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key)
    }
  }

  private evictIfNeeded() {
    if (this.cache.size <= this.opts.maxEntries) return
    // Drop expired entries first (this replaces the old periodic timer sweep)…
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key)
    }
    if (this.cache.size <= this.opts.maxEntries) return
    // …then evict oldest-expiring until under the limit.
    const entries = [...this.cache.entries()]
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    const toRemove = entries.slice(0, entries.length - this.opts.maxEntries)
    for (const [key] of toRemove) this.cache.delete(key)
  }
}

/**
 * Create a caching plugin.
 * Caches list/get responses and invalidates on mutations.
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
    store = new InMemoryCacheStore({ maxEntries, cleanupMs: Math.max(ttlMs, 30000) }),
  } = options

  function shouldCache(resource: string): boolean {
    if (!resources) return true
    return resources.includes(resource)
  }

  function generateKey(context: any): string {
    if (keyGenerator) return keyGenerator(context)

    const parts = [
      context.resource,
      context.operation,
      context.event?.path ?? '',
      JSON.stringify(context.query || {}),
      context.params?.id || '',
      context.user?.id || 'anon',
      context.tenant?.id || '',
    ]
    return parts.join(':')
  }

  return pluginFromFactory('createCachePlugin', [options], {
    name: 'cache',
    version: '1.1.0',
    runtimeSetup(ctx) {
      // Pre-execute middleware: serve from cache
      ctx.addMiddleware({
        name: 'cache-read',
        stage: 'pre-execute',
        order: -50,
        operations: operations as any[],
        handler: async (context) => {
          if (!shouldCache(context.resource)) return

          const key = generateKey(context)
          const data = await store.get(key)
          if (data !== undefined) {
            context.shortCircuit = { data }
          }
        },
      })

      // Post-execute: cache the response exactly as the handler returned it (data AND meta — pagination, cursors).
      ctx.addMiddleware({
        name: 'cache-write',
        stage: 'post-execute',
        order: 50,
        operations: operations as any[],
        handler: async (context) => {
          if (!shouldCache(context.resource) || context.shortCircuit || context.result === undefined) return
          await store.set(generateKey(context), context.result, ttlMs)
        },
      })

      // Post-execute: a successful write drops the resource's cached responses. Middleware, not after-hooks, so
      // every write route counts — bulk, restore and M2M included.
      ctx.addMiddleware({
        name: 'cache-invalidate',
        stage: 'post-execute',
        order: 60,
        handler: async (context) => {
          const op = context.operation === 'm2m' ? (context.event?.method === 'GET' ? null : 'update') : context.operation
          if (op && (invalidateOn as string[]).includes(op)) await store.deleteByPrefix(`${context.resource}:`)
        },
      })

      ctx.logger.info(`Cache enabled: TTL ${ttlMs}ms, max ${maxEntries} entries`)
    },
  })
}
