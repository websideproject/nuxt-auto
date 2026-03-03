import type { H3Event } from 'h3'
import { readBody, getQuery, createError } from 'h3'
import { getDatabaseAdapter } from '../database'
import { getContextExtenders } from '../plugins/pluginRegistry'
import { serializeResponse } from './serializeResponse'
import { filterHiddenFields } from './filterHiddenFields'
import type { HandlerContext } from '../../types'

/**
 * Get a lightweight HandlerContext for use in standalone server handlers.
 * Includes database, user, and runs context extenders from plugins.
 *
 * @example
 * ```ts
 * export default defineEventHandler(async (event) => {
 *   const ctx = await getAutoApiContext(event)
 *   const users = await ctx.db.select().from(users)
 *   return respondWith(users)
 * })
 * ```
 */
export async function getAutoApiContext(
  event: H3Event,
  opts?: { resource?: string; operation?: HandlerContext['operation'] }
): Promise<HandlerContext> {
  let adapter
  let db
  try {
    adapter = getDatabaseAdapter()
    db = adapter.db
  } catch {
    db = (globalThis as any).__autoApiDb
  }

  const user = (event.context as any).user || null
  const permissions = (event.context as any).permissions || user?.permissions || []

  const context: HandlerContext = {
    db,
    adapter,
    schema: {},
    user,
    permissions,
    params: (event.context as any).params || {},
    query: getQuery(event) as Record<string, any>,
    validated: {},
    event,
    resource: opts?.resource || '',
    operation: opts?.operation || 'get',
  }

  // Run context extenders from plugins
  const extenders = getContextExtenders()
  for (const ext of extenders) {
    await ext(context)
  }

  return context
}

/**
 * Validate request body against a Zod schema. Throws 400 on failure.
 */
export async function validateBody<T>(event: H3Event, schema: any): Promise<T> {
  const rawBody = await readBody(event).catch(() => null)
  const result = schema.safeParse(rawBody)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Body validation failed',
      data: { errors: result.error.issues },
    })
  }
  return result.data as T
}

/**
 * Validate query parameters against a Zod schema. Throws 400 on failure.
 */
export function validateQuery<T>(event: H3Event, schema: any): T {
  const rawQuery = getQuery(event)
  const result = schema.safeParse(rawQuery)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Query validation failed',
      data: { errors: result.error.issues },
    })
  }
  return result.data as T
}

/**
 * Wrap data in a standard `{ data }` response envelope with serialization.
 */
export function respondWith<T>(data: T): { data: T } {
  return serializeResponse({ data })
}

/**
 * Wrap list data in a standard `{ data, meta }` response envelope with serialization.
 */
export function respondWithList<T>(data: T[], meta?: Record<string, any>): { data: T[]; meta: Record<string, any> } {
  return serializeResponse({ data, meta: meta || {} })
}

/**
 * Throw a standardized H3 error.
 */
export function respondWithError(statusCode: number, message: string, details?: any): never {
  throw createError({
    statusCode,
    message,
    data: details ? { details } : undefined,
  })
}

/**
 * Get the database instance and adapter.
 */
export function getDb(): { db: any; adapter: ReturnType<typeof getDatabaseAdapter> } {
  const adapter = getDatabaseAdapter()
  return { db: adapter.db, adapter }
}

/**
 * Get a resource schema (table) from the virtual module registry.
 */
export async function getResourceSchema(name: string): Promise<any> {
  const { registry } = await import('#nuxt-auto-api-registry' as string) as any
  return registry[name]?.schema
}

/**
 * Get the full resource registry.
 */
export async function getRegistry(): Promise<Record<string, any>> {
  const { registry } = await import('#nuxt-auto-api-registry' as string) as any
  return registry
}

// Re-export utilities with shorter aliases
export { serializeResponse as serialize } from './serializeResponse'
export { filterHiddenFields as filterHidden } from './filterHiddenFields'
