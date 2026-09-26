import { z } from 'zod'
import { createInsertSchema } from 'drizzle-zod'
import type { HandlerContext, ResourceRegistration, ValidationSchema } from '../../types'
import { protectedFieldsFor } from '../utils/protectedFields'

function coerceDateField(type: z.ZodTypeAny): z.ZodTypeAny {
  if (type instanceof z.ZodDate) return z.coerce.date()
  if (type instanceof z.ZodOptional) return z.optional(coerceDateField((type as z.ZodOptional<z.ZodTypeAny>).unwrap()))
  if (type instanceof z.ZodNullable) return z.nullable(coerceDateField((type as z.ZodNullable<z.ZodTypeAny>).unwrap()))
  return type
}

/**
 * Generate create/update schemas for a Drizzle table with drizzle-zod.
 *
 * Dates accept ISO strings. Columns in `omit` (server-owned: primary key on update, tenant, soft-delete,
 * audit stamps) are left out, so they are never *required* and never *accepted* — an object schema drops
 * unknown keys.
 */
export function generateSchemas(table: any, options: {
  createSchema?: z.ZodType<any>
  updateSchema?: z.ZodType<any>
  omitOnCreate?: Iterable<string>
  omitOnUpdate?: Iterable<string>
} = {}) {
  const insert = createInsertSchema(table, {}) as z.ZodObject<any>
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, type] of Object.entries(insert.shape as Record<string, z.ZodTypeAny>)) shape[key] = coerceDateField(type)

  const without = (omit: Iterable<string> | undefined) => {
    const drop = new Set(omit ?? [])
    return Object.fromEntries(Object.entries(shape).filter(([k]) => !drop.has(k)))
  }

  return {
    create: options.createSchema || z.object(without(options.omitOnCreate)),
    update: options.updateSchema || z.object(without(options.omitOnUpdate)).partial(),
  }
}

/**
 * Query-string schema. Known keys are typed; unknown keys pass through untouched (plugins such as search
 * read their own parameters).
 */
export function generateQuerySchema() {
  const stringOrList = z.union([z.string(), z.array(z.string())]).optional()
  return z.object({
    filter: z.any().optional(),
    sort: stringOrList,
    fields: stringOrList,
    include: stringOrList,
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
    includeDeleted: z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]).optional(),
    onlyDeleted: z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]).optional(),
    aggregate: z.string().optional(),
  }).passthrough()
}

const cache = new Map<string, { create: z.ZodType<any>, update: z.ZodType<any>, query: z.ZodType<any> }>()

/**
 * The validation schemas for one resource in this request. A registration's own `validation` wins;
 * otherwise schemas are generated from the table (cached — generation walks every column).
 */
export function schemasFor(context: HandlerContext, resource: string, registration: ResourceRegistration): ValidationSchema {
  const custom = registration.validation as ValidationSchema | undefined
  const table = registration.schema
  const omitOnCreate = [...protectedFieldsFor(context, resource, table, 'create')].sort()
  const omitOnUpdate = [...protectedFieldsFor(context, resource, table, 'update')].sort()
  const key = `${resource}|${omitOnCreate.join(',')}|${omitOnUpdate.join(',')}`

  let generated = cache.get(key)
  if (!generated) {
    try {
      generated = { ...generateSchemas(table, { omitOnCreate, omitOnUpdate }), query: generateQuerySchema() }
    }
    catch (error) {
      console.warn(`[nuxt-auto-api] Could not generate validation schemas for "${resource}"; bodies are not validated`, error)
      generated = { create: z.object({}).passthrough(), update: z.object({}).passthrough(), query: generateQuerySchema() }
    }
    cache.set(key, generated)
  }

  return {
    create: custom?.create ?? generated.create,
    update: custom?.update ?? generated.update,
    query: custom?.query ?? generated.query,
  }
}

/**
 * Define a custom validation schema for a resource. Any part left out is generated from the table.
 */
export function defineValidationSchema(schema: {
  create?: z.ZodType<any>
  update?: z.ZodType<any>
  query?: z.ZodType<any>
}): ValidationSchema {
  return { ...schema }
}

/** Refine a generated schema. */
export function refineSchema<T extends z.ZodType<any>>(baseSchema: T, refinements: (schema: T) => T): T {
  return refinements(baseSchema)
}
