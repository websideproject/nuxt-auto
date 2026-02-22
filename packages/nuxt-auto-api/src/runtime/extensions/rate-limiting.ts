import type { Extension, ExtensionContext } from '../types'
import { createError } from 'h3'

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /**
   * Window size in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number

  /**
   * Maximum number of requests per window
   * @default 100
   */
  max?: number

  /**
   * Rate limit by IP address
   * @default true
   */
  byIp?: boolean

  /**
   * Rate limit by user ID (requires authentication)
   * @default false
   */
  byUser?: boolean

  /**
   * Custom key generator function
   */
  keyGenerator?: (event: any) => string

  /**
   * Skip rate limiting for certain conditions
   */
  skip?: (event: any) => boolean

  /**
   * Custom error message
   */
  message?: string

  /**
   * Custom storage backend
   */
  store?: RateLimitStore
}

/**
 * Rate limit storage interface
 */
export interface RateLimitStore {
  increment(key: string): Promise<number>
  reset(key: string): Promise<void>
  get(key: string): Promise<number>
}

/**
 * In-memory rate limit store
 */
class MemoryStore implements RateLimitStore {
  private store: Map<string, { count: number; resetAt: number }> = new Map()
  private windowMs: number

  constructor(windowMs: number) {
    this.windowMs = windowMs
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  async increment(key: string): Promise<number> {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      // New window
      this.store.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      })
      return 1
    }

    // Increment existing window
    entry.count++
    return entry.count
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key)
  }

  async get(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry) return 0

    const now = Date.now()
    if (now > entry.resetAt) {
      this.store.delete(key)
      return 0
    }

    return entry.count
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}

/**
 * Create a rate limiting extension
 *
 * @example
 * ```ts
 * export default defineNuxtConfig({
 *   autoApi: {
 *     extensions: [
 *       createRateLimitExtension({
 *         windowMs: 60000, // 1 minute
 *         max: 100, // 100 requests per minute
 *         byIp: true,
 *         byUser: true,
 *       })
 *     ]
 *   }
 * })
 * ```
 */
export function createRateLimitExtension(config: RateLimitConfig = {}): Extension {
  const {
    windowMs = 60000,
    max = 100,
    byIp = true,
    byUser = false,
    keyGenerator,
    skip,
    message = 'Too many requests, please try again later',
    store,
  } = config

  const rateLimitStore = store || new MemoryStore(windowMs)

  return {
    name: 'rate-limiting',
    setup: (context: ExtensionContext) => {
      // Add a Nitro plugin to check rate limits on every request
      // Note: This is a simplified example
      // In production, you'd want to hook into Nitro's middleware system

      console.log('[autoApi] Rate limiting extension enabled')
      console.log(`  - Window: ${windowMs}ms`)
      console.log(`  - Max requests: ${max}`)
      console.log(`  - By IP: ${byIp}`)
      console.log(`  - By User: ${byUser}`)

      // Store config in globalThis for access in server handlers
      ;(globalThis as any).__rateLimitConfig = {
        windowMs,
        max,
        byIp,
        byUser,
        keyGenerator,
        skip,
        message,
        store: rateLimitStore,
      }
    },
  }
}

/**
 * Server middleware to check rate limits
 * Use this in a Nitro plugin to apply rate limiting
 *
 * @example
 * ```ts
 * // server/plugins/rate-limit.ts
 * export default defineNitroPlugin((nitroApp) => {
 *   nitroApp.hooks.hook('request', async (event) => {
 *     await checkRateLimit(event)
 *   })
 * })
 * ```
 */
export async function checkRateLimit(event: any): Promise<void> {
  const config = (globalThis as any).__rateLimitConfig
  if (!config) return

  // Skip if condition is met
  if (config.skip && config.skip(event)) {
    return
  }

  // Generate rate limit key
  let key: string
  if (config.keyGenerator) {
    key = config.keyGenerator(event)
  } else {
    const parts: string[] = []

    if (config.byIp) {
      const ip = event.node?.req?.headers?.['x-forwarded-for'] ||
                 event.node?.req?.socket?.remoteAddress ||
                 'unknown'
      parts.push(`ip:${ip}`)
    }

    if (config.byUser) {
      // Try to get user from context (requires authentication middleware)
      const user = event.context?.user
      if (user?.id) {
        parts.push(`user:${user.id}`)
      }
    }

    if (parts.length === 0) {
      parts.push('global')
    }

    key = parts.join(':')
  }

  // Check rate limit
  const count = await config.store.increment(key)

  if (count > config.max) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: config.message,
      data: {
        limit: config.max,
        windowMs: config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000),
      },
    })
  }

  // Add rate limit headers to response
  if (event.node?.res) {
    event.node.res.setHeader('X-RateLimit-Limit', config.max)
    event.node.res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count))
    event.node.res.setHeader('X-RateLimit-Reset', Date.now() + config.windowMs)
  }
}

/**
 * Export a default rate limiting extension with sensible defaults
 */
export default createRateLimitExtension()
