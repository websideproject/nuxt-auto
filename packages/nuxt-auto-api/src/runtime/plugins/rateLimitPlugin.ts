import { createError } from 'h3'
import { pluginFromFactory } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

/**
 * Pluggable backing store for rate-limit counters.
 *
 * The default is in-process memory (see `InMemoryRateLimitStore`) — correct for a
 * single Node process, but NOT for multi-isolate runtimes (Cloudflare Workers), where
 * each isolate has its own memory and a global limit leaks. Supply a shared store
 * (Cloudflare KV / Durable Object, Redis, …) via `RateLimitPluginOptions.store` there.
 */
export interface RateLimitStore {
  /**
   * Atomically increment the counter for `key` within a `windowMs` window.
   * Returns the new count and the window's reset timestamp (epoch ms).
   * Implementations must (re)start the window when it has expired.
   */
  increment: (key: string, windowMs: number) => Promise<{ count: number, resetAt: number }>
  /** Clear a key (optional — TTL-based stores can no-op). */
  reset?: (key: string) => Promise<void>
}

/**
 * Decision-based limiter — returns allow/deny instead of a count.
 *
 * Shape matches the **Cloudflare Workers RateLimit binding** exactly, so you can pass
 * `env.RATE_LIMITER` straight through. The limit/period are configured in `wrangler.toml`
 * (the binding owns the distributed counting), so the plugin's `max`/`windowMs` are
 * advisory here (used only for best-effort response headers).
 *
 * ```toml
 * # wrangler.toml
 * [[unsafe.bindings]]
 * name = "RATE_LIMITER"
 * type = "ratelimit"
 * namespace_id = "1"
 * simple = { limit = 100, period = 60 }
 * ```
 */
export interface RateLimitLimiter {
  limit: (args: { key: string }) => Promise<{ success: boolean }>
}

export interface RateLimitPluginOptions {
  /** Window size in milliseconds. @default 60000 */
  windowMs?: number
  /** Maximum requests per window. @default 100 */
  max?: number
  /**
   * Rate limit by the client's IP address. @default true
   *
   * The address is the connection's, or `CF-Connecting-IP` when the request came through Cloudflare's runtime
   * (Cloudflare sets that header itself). `X-Forwarded-For` is only read with `trustProxy` — without a proxy
   * in front, a client sets it to anything and gets a fresh bucket on every request.
   */
  byIp?: boolean
  /**
   * Behind your own reverse proxy / load balancer: how many proxies append to `X-Forwarded-For` (`true` = 1).
   * The client address is the entry that many hops from the right — the one your outermost proxy saw.
   * @default false
   */
  trustProxy?: boolean | number
  /** Rate limit by user ID. @default false */
  byUser?: boolean
  /** Custom key generator */
  keyGenerator?: (context: any) => string
  /** Skip rate limiting for certain conditions */
  skip?: (context: any) => boolean
  /** Custom error message */
  message?: string
  /**
   * Backing store (counter-based). @default new InMemoryRateLimitStore()
   * On Cloudflare Workers / any multi-isolate runtime, pass a shared store (KV) — or
   * prefer `limiter` with the native CF RateLimit binding.
   */
  store?: RateLimitStore
  /**
   * Decision-based limiter (e.g. the Cloudflare Workers RateLimit binding). When set it
   * takes precedence over `store`. Pass the binding directly, or a resolver that reads it
   * from the request context (CF bindings live on `env`, which Nitro exposes per-request,
   * e.g. `(ctx) => ctx.event.context.cloudflare?.env?.RATE_LIMITER`).
   */
  limiter?: RateLimitLimiter | ((context: any) => RateLimitLimiter | undefined)
  /**
   * If the store/limiter throws (e.g. KV outage), allow the request through (fail open)
   * instead of erroring. @default true. Set `false` on sensitive routes to fail closed.
   */
  failOpen?: boolean
}

function header(event: any, name: string): string | undefined {
  const value = event?.node?.req?.headers?.[name] ?? event?.headers?.get?.(name)
  return (Array.isArray(value) ? value[0] : value) || undefined
}

/**
 * The client address a limit is keyed on. Only headers that cannot be forged are used: `CF-Connecting-IP` when
 * the request came through Cloudflare's runtime (Nitro's Cloudflare presets set `event.context.cloudflare`), and
 * `X-Forwarded-For` only when the app says how many proxies of its own write it.
 */
export function clientAddress(event: any, trustProxy: boolean | number = false): string {
  if (event?.context?.cloudflare) {
    const ip = header(event, 'cf-connecting-ip')
    if (ip) return ip
  }
  const hops = trustProxy === true ? 1 : Number(trustProxy) || 0
  if (hops > 0) {
    const chain = String(header(event, 'x-forwarded-for') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const ip = chain[chain.length - hops]
    if (ip) return ip
  }
  return event?.node?.req?.socket?.remoteAddress || 'unknown'
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * Default in-process store. Fine for a single Node process / dev.
 * Replaces the previous inline `Map` with identical semantics, plus self-cleanup.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  // No periodic cleanup timer: Cloudflare Workers disallow setInterval/setTimeout in global scope, and this
  // store can be constructed at plugin setup (isolate init). Entries reset lazily in increment(); stale keys
  // are swept there opportunistically once the store grows large.
  private store = new Map<string, RateLimitEntry>()

  async increment(key: string, windowMs: number): Promise<{ count: number, resetAt: number }> {
    const now = Date.now()
    const entry = this.store.get(key)
    if (!entry || now > entry.resetAt) {
      // Opportunistic sweep of expired keys when the map grows (replaces the periodic timer),
      // bounding memory for keys that never come back.
      if (this.store.size > 10_000) {
        for (const [k, e] of this.store) {
          if (now > e.resetAt) this.store.delete(k)
        }
      }
      const fresh = { count: 1, resetAt: now + windowMs }
      this.store.set(key, fresh)
      return fresh
    }
    entry.count++
    return { count: entry.count, resetAt: entry.resetAt }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key)
  }
}

/**
 * Create a rate-limiting plugin
 *
 * @example
 * ```ts
 * import { createRateLimitPlugin } from 'nuxt-auto-api/plugins'
 *
 * export default defineNuxtConfig({
 *   autoApi: {
 *     plugins: [
 *       createRateLimitPlugin({ windowMs: 60000, max: 100 })
 *     ]
 *   }
 * })
 * ```
 */
export function createRateLimitPlugin(options: RateLimitPluginOptions = {}): AutoApiPlugin {
  const {
    windowMs = 60000,
    max = 100,
    byIp = true,
    byUser = false,
    trustProxy = false,
    keyGenerator,
    skip,
    message = 'Too many requests, please try again later',
    store = new InMemoryRateLimitStore(),
    limiter,
    failOpen = true,
  } = options

  const resolveLimiter = typeof limiter === 'function'
    ? limiter
    : () => limiter

  return pluginFromFactory('createRateLimitPlugin', [options], {
    name: 'rate-limit',
    version: '1.1.0',
    runtimeSetup(ctx) {
      ctx.addMiddleware({
        name: 'rate-limit',
        stage: 'pre-auth',
        order: -100, // Run very early
        handler: async (context) => {
          // Skip check if configured
          if (skip && skip(context)) return

          // Generate key
          let key: string
          if (keyGenerator) {
            key = keyGenerator(context)
          }
          else {
            const parts: string[] = []
            if (byIp) parts.push(`ip:${clientAddress(context.event, trustProxy)}`)
            if (byUser && context.user?.id) {
              parts.push(`user:${context.user.id}`)
            }
            if (parts.length === 0) parts.push('global')
            key = parts.join(':')
          }

          const event = context.event
          const res = event.node?.res

          // Decision-based limiter (e.g. Cloudflare RateLimit binding) takes precedence.
          // It owns the distributed counting; we only get allow/deny, so headers are best-effort.
          const lim = resolveLimiter(context)
          if (lim) {
            let allowed = true
            try {
              const r = await lim.limit({ key })
              allowed = r.success
            }
            catch (err) {
              if (failOpen) {
                ctx.logger.warn(`Rate-limit limiter error (failing open): ${(err as Error)?.message ?? err}`)
                return
              }
              throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message })
            }
            if (!allowed) {
              if (res) {
                res.setHeader('Retry-After', String(Math.max(1, Math.ceil(windowMs / 1000))))
                res.setHeader('X-RateLimit-Limit', String(max))
                res.setHeader('X-RateLimit-Remaining', '0')
              }
              throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message })
            }
            if (res) res.setHeader('X-RateLimit-Limit', String(max))
            return
          }

          // Increment via the (possibly shared) counter store.
          let count: number
          let resetAt: number
          try {
            const result = await store.increment(key, windowMs)
            count = result.count
            resetAt = result.resetAt
          }
          catch (err) {
            // Store outage: fail open (default) or closed per config.
            if (failOpen) {
              ctx.logger.warn(`Rate-limit store error (failing open): ${(err as Error)?.message ?? err}`)
              return
            }
            throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message })
          }

          if (count > max) {
            const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
            if (res) {
              res.setHeader('Retry-After', String(retryAfterSec))
              res.setHeader('X-RateLimit-Limit', String(max))
              res.setHeader('X-RateLimit-Remaining', '0')
              res.setHeader('X-RateLimit-Reset', String(resetAt))
            }
            throw createError({
              statusCode: 429,
              statusMessage: 'Too Many Requests',
              message,
            })
          }

          if (res) {
            res.setHeader('X-RateLimit-Limit', String(max))
            res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)))
            res.setHeader('X-RateLimit-Reset', String(resetAt))
          }
        },
      })

      ctx.logger.info(`Rate limiting enabled: ${max} requests per ${windowMs}ms`)
    },
  })
}
