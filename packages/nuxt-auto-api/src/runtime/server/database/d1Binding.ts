import { defineNitroPlugin } from 'nitropack/runtime'
import { createError } from 'h3'
import { drizzle } from 'drizzle-orm/d1'
import { initializeDatabase } from './index'

/**
 * A Nitro plugin that initializes the database from a Cloudflare D1 binding.
 *
 * A Worker's bindings exist per request (`event.context.cloudflare.env`), not when Nitro plugins run, so the
 * database is created on the first request — and again only if the binding object changes.
 *
 * @example
 * ```ts
 * // server/plugins/database.ts
 * import * as schema from '../database/schema'
 *
 * export default initializeDatabaseFromBinding('DB', { schema })
 * ```
 */
export function initializeDatabaseFromBinding(binding = 'DB', options: { schema?: Record<string, unknown> } = {}) {
  return defineNitroPlugin((nitroApp) => {
    let current: unknown
    nitroApp.hooks.hook('request', (event) => {
      const d1 = (event.context as any).cloudflare?.env?.[binding]
      if (!d1) throw createError({ statusCode: 500, message: `D1 binding "${binding}" not found` })
      if (d1 === current) return
      initializeDatabase(drizzle(d1, { schema: options.schema }), 'd1')
      current = d1
    })
  })
}
