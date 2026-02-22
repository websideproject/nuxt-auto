import { eq } from 'drizzle-orm'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface SlugPluginOptions {
  /** Resource-to-field mapping: { articles: { source: 'title', target: 'slug' } } */
  resources: Record<string, { source: string; target: string }>
  /** Slug separator character. @default '-' */
  separator?: string
  /** Maximum slug length. @default 80 */
  maxLength?: number
}

/**
 * Transliterate a string to ASCII and convert to a URL-safe slug.
 */
function slugify(text: string, separator: string, maxLength: number): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // Remove non-alphanumeric
    .replace(/[\s_]+/g, separator)   // Spaces/underscores to separator
    .replace(new RegExp(`[${separator}]+`, 'g'), separator) // Collapse repeated separators
    .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '') // Trim separators
    .slice(0, maxLength)
}

/**
 * Ensure slug uniqueness by appending -2, -3, etc.
 */
async function ensureUnique(
  db: any,
  table: any,
  targetColumn: string,
  baseSlug: string,
  excludeId?: string | number,
): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const conditions = [eq(table[targetColumn], slug)]
    let query = db.select({ id: table.id }).from(table).where(eq(table[targetColumn], slug))
    const existing = await query

    const conflict = excludeId
      ? existing.find((r: any) => String(r.id) !== String(excludeId))
      : existing[0]

    if (!conflict) return slug

    counter++
    slug = `${baseSlug}-${counter}`
  }
}

/**
 * Create a slug generation plugin.
 *
 * @example
 * ```ts
 * createSlugPlugin({
 *   resources: {
 *     articles: { source: 'title', target: 'slug' },
 *     categories: { source: 'name', target: 'slug' },
 *   },
 * })
 * ```
 */
export function createSlugPlugin(options: SlugPluginOptions): AutoApiPlugin {
  const { resources, separator = '-', maxLength = 80 } = options

  return defineAutoApiPlugin({
    name: 'slug',
    version: '1.0.0',
    runtimeSetup(ctx) {
      for (const [resource, config] of Object.entries(resources)) {
        ctx.addHook(resource, {
          async beforeCreate(data, context) {
            if (!data[config.source]) return data

            const table = context.schema[resource]
            const baseSlug = slugify(data[config.source], separator, maxLength)
            const slug = await ensureUnique(context.db, table, config.target, baseSlug)

            return { ...data, [config.target]: slug }
          },

          async beforeUpdate(id, data, context) {
            if (data[config.source] === undefined) return data

            const table = context.schema[resource]
            const baseSlug = slugify(data[config.source], separator, maxLength)
            const slug = await ensureUnique(context.db, table, config.target, baseSlug, id)

            return { ...data, [config.target]: slug }
          },
        })
      }

      ctx.logger.info(`Slug generation enabled for: ${Object.keys(resources).join(', ')}`)
    },
  })
}
