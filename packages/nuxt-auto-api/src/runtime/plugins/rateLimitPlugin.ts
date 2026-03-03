import { createError } from 'h3'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface RateLimitPluginOptions {
  /** Window size in milliseconds. @default 60000 */
  windowMs?: number
  /** Maximum requests per window. @default 100 */
  max?: number
  /** Rate limit by IP address. @default true */
  byIp?: boolean
  /** Rate limit by user ID. @default false */
  byUser?: boolean
  /** Custom key generator */
  keyGenerator?: (context: any) => string
  /** Skip rate limiting for certain conditions */
  skip?: (context: any) => boolean
  /** Custom error message */
  message?: string
}

interface RateLimitEntry {
  count: number
  resetAt: number
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
    keyGenerator,
    skip,
    message = 'Too many requests, please try again later',
  } = options

  const store = new Map<string, RateLimitEntry>()

  // Cleanup interval
  let cleanupTimer: ReturnType<typeof setInterval> | null = null

  return defineAutoApiPlugin({
    name: 'rate-limit',
    version: '1.0.0',
    runtimeSetup(ctx) {
      // Start cleanup timer
      cleanupTimer = setInterval(() => {
        const now = Date.now()
        for (const [key, entry] of store.entries()) {
          if (now > entry.resetAt) {
            store.delete(key)
          }
        }
      }, 60000)

      // Prevent timer from keeping the process alive
      if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
        cleanupTimer.unref()
      }

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
          } else {
            const parts: string[] = []
            if (byIp) {
              const event = context.event
              const ip = event.node?.req?.headers?.['x-forwarded-for'] ||
                         event.node?.req?.socket?.remoteAddress ||
                         'unknown'
              parts.push(`ip:${Array.isArray(ip) ? ip[0] : ip}`)
            }
            if (byUser && context.user?.id) {
              parts.push(`user:${context.user.id}`)
            }
            if (parts.length === 0) parts.push('global')
            key = parts.join(':')
          }

          // Check rate limit
          const now = Date.now()
          const entry = store.get(key)

          if (!entry || now > entry.resetAt) {
            store.set(key, { count: 1, resetAt: now + windowMs })
          } else {
            entry.count++
            if (entry.count > max) {
              throw createError({
                statusCode: 429,
                statusMessage: 'Too Many Requests',
                message,
              })
            }
          }

          // Set rate limit headers
          const current = store.get(key)!
          const event = context.event
          if (event.node?.res) {
            event.node.res.setHeader('X-RateLimit-Limit', String(max))
            event.node.res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current.count)))
            event.node.res.setHeader('X-RateLimit-Reset', String(current.resetAt))
          }
        },
      })

      ctx.logger.info(`Rate limiting enabled: ${max} requests per ${windowMs}ms`)
    },
  })
}
