import { createError } from 'h3'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

/** Any object implementing the Standard Schema .safeParse() interface (Zod, Valibot, etc.) */
interface ParseableSchema {
  safeParse: (data: any) => { success: boolean; error?: any; data?: any }
}

export interface SchemaValidationPluginOptions {
  /** Per-resource validation schemas */
  resources: Record<string, {
    create?: ParseableSchema
    update?: ParseableSchema
  }>
}

/**
 * Create a schema validation plugin.
 * Supports any schema library implementing `.safeParse()` (Zod, Valibot, ArkType, etc.).
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * createSchemaValidationPlugin({
 *   resources: {
 *     users: {
 *       create: z.object({ email: z.string().email(), age: z.number().min(18) }),
 *       update: z.object({ email: z.string().email().optional() }),
 *     },
 *   },
 * })
 * ```
 */
export function createSchemaValidationPlugin(options: SchemaValidationPluginOptions): AutoApiPlugin {
  const { resources } = options

  return defineAutoApiPlugin({
    name: 'schema-validation',
    version: '1.0.0',
    runtimeSetup(ctx) {
      for (const [resource, schemas] of Object.entries(resources)) {
        ctx.addHook(resource, {
          beforeCreate(data, _context) {
            if (!schemas.create) return data

            const result = schemas.create.safeParse(data)
            if (!result.success) {
              throw createError({
                statusCode: 422,
                message: 'Validation failed',
                data: {
                  errors: result.error?.issues || result.error?.errors || result.error,
                },
              })
            }
            return result.data ?? data
          },

          beforeUpdate(_id, data, _context) {
            if (!schemas.update) return data

            const result = schemas.update.safeParse(data)
            if (!result.success) {
              throw createError({
                statusCode: 422,
                message: 'Validation failed',
                data: {
                  errors: result.error?.issues || result.error?.errors || result.error,
                },
              })
            }
            return result.data ?? data
          },
        })
      }

      ctx.logger.info(`Schema validation enabled for: ${Object.keys(resources).join(', ')}`)
    },
  })
}
