import { like, ilike, or } from 'drizzle-orm'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface SearchPluginOptions {
  /** Per-resource searchable fields: { articles: { fields: ['title', 'body'] } } */
  resources: Record<string, {
    fields: string[]
    /** Minimum query length to trigger search. @default 2 */
    minLength?: number
  }>
  /** Query parameter name for the search term. @default 'q' */
  queryParam?: string
  /** Use case-insensitive matching (ilike). @default true */
  caseInsensitive?: boolean
}

/**
 * Create a search plugin.
 * Adds full-text-like search via SQL LIKE/ILIKE to list queries.
 *
 * @example
 * ```ts
 * createSearchPlugin({
 *   resources: {
 *     articles: { fields: ['title', 'body'], minLength: 3 },
 *     users: { fields: ['name', 'email'] },
 *   },
 *   queryParam: 'q',
 * })
 * ```
 */
export function createSearchPlugin(options: SearchPluginOptions): AutoApiPlugin {
  const {
    resources,
    queryParam = 'q',
    caseInsensitive = true,
  } = options

  return defineAutoApiPlugin({
    name: 'search',
    version: '1.0.0',
    runtimeSetup(ctx) {
      for (const [resource, config] of Object.entries(resources)) {
        const { fields, minLength = 2 } = config

        ctx.addHook(resource, {
          beforeList(context) {
            const searchTerm = context.query[queryParam]
            if (!searchTerm || typeof searchTerm !== 'string') return
            if (searchTerm.length < minLength) return

            const table = context.schema[resource]
            if (!table) return

            const pattern = `%${searchTerm}%`
            const likeFn = caseInsensitive ? ilike : like

            const conditions = fields
              .filter(field => table[field]) // Only use fields that exist in the table
              .map(field => likeFn(table[field], pattern))

            if (conditions.length === 0) return

            const searchCondition = conditions.length === 1 ? conditions[0] : or(...conditions)

            if (!context.additionalFilters) {
              context.additionalFilters = []
            }
            if (searchCondition) {
              context.additionalFilters.push(searchCondition)
            }
          },
        })
      }

      ctx.logger.info(`Search enabled for: ${Object.keys(resources).join(', ')}`)
    },
  })
}
