import { z } from 'zod'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

/**
 * Generate Zod schemas from Drizzle table using drizzle-zod
 */
export function generateSchemas(table: any, options?: {
  createSchema?: z.ZodType<any>
  updateSchema?: z.ZodType<any>
}) {
  try {
    // Use drizzle-zod to generate schemas from table
    const insertSchema = createInsertSchema(table, {})
    const selectSchema = createSelectSchema(table, {})

    // For create: use the insert schema (required fields)
    const create = options?.createSchema || insertSchema

    // For update: make all fields optional since it's a partial update
    const update = options?.updateSchema || insertSchema.partial()

    return { create, update }
  } catch (error) {
    // Fallback if drizzle-zod fails (e.g., table doesn't have proper metadata)
    console.warn('[nuxt-auto-api] Failed to generate schemas from table, using passthrough', error)
    return {
      create: z.object({}).passthrough(),
      update: z.object({}).passthrough(),
    }
  }
}

/**
 * Generate query parameter schema
 */
export function generateQuerySchema() {
  return z.object({
    // Filter can be either an object (from JS) or string (from URL) - middleware handles parsing
    filter: z.any().optional(),
    sort: z.union([z.string(), z.array(z.string())]).optional(),
    fields: z.union([z.string(), z.array(z.string())]).optional(),
    include: z.union([z.string(), z.array(z.string())]).optional(),
    // Offset pagination
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    // Cursor pagination
    cursor: z.string().optional(),
    cursorFields: z.union([z.string(), z.array(z.string())]).optional().transform(val => {
      if (typeof val === 'string') return val.split(',')
      return val
    }),
  })
}

/**
 * Create a custom validation schema for a resource
 */
export function defineValidationSchema(schema: {
  create?: z.ZodType<any>
  update?: z.ZodType<any>
  query?: z.ZodType<any>
}) {
  return {
    create: schema.create || z.object({}).passthrough() as z.ZodType<any>,
    update: schema.update || z.object({}).passthrough() as z.ZodType<any>,
    query: schema.query || generateQuerySchema() as z.ZodType<any>,
  }
}

/**
 * Helper to refine generated schemas with custom validations
 */
export function refineSchema<T extends z.ZodType<any>>(
  baseSchema: T,
  refinements: (schema: T) => T
): T {
  return refinements(baseSchema)
}
