import { or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { pluginFromFactory } from '../types/plugin'
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
  /** Case-insensitive matching. @default true */
  caseInsensitive?: boolean
}

/**
 * `term` anywhere in any of `columns`, on every engine: `LIKE` with the term's own `%` / `_` escaped (they match
 * literally), lower-cased on both sides when case-insensitive (`ILIKE` exists only on Postgres).
 */
export function searchCondition(columns: any[], term: string, caseInsensitive = true): SQL | undefined {
  const escaped = `%${term.replace(/[!%_]/g, '!$&')}%`
  const conditions = columns.map(column => caseInsensitive
    ? sql`lower(${column}) like ${escaped.toLowerCase()} escape '!'`
    : sql`${column} like ${escaped} escape '!'`)
  return conditions.length > 1 ? or(...conditions) : conditions[0]
}

/**
 * Create a search plugin.
 * Adds substring search (`?q=term`) over configured columns to list queries — on every engine.
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

  return pluginFromFactory('createSearchPlugin', [options], {
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

            const condition = searchCondition(fields.filter(field => table[field]).map(field => table[field]), searchTerm, caseInsensitive)
            if (!condition) return
            ;(context.additionalFilters ??= []).push(condition)
          },
        })
      }

      ctx.logger.info(`Search enabled for: ${Object.keys(resources).join(', ')}`)
    },
  })
}
