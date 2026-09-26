import type { H3Event } from 'h3'
import { readBody, getQuery, createError } from 'h3'
import { getAuthConfig } from './authConfig'
import { getDatabaseAdapter } from '../database'
import { serializeResponse } from './serializeResponse'
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
  opts?: { resource?: string, operation?: HandlerContext['operation'] },
): Promise<HandlerContext> {
  const { createCallerContext } = await import('../handlers/createContextFromRegistry')
  const context = await createCallerContext(event, opts?.operation || 'get')
  if (opts?.resource) {
    context.resource = opts.resource
    context.resourceConfig = context.registry?.[opts.resource]
    context.effectiveAuth = getAuthConfig(context, opts.resource)
  }
  return context
}

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
export function respondWithList<T>(data: T[], meta?: Record<string, any>): { data: T[], meta: Record<string, any> } {
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
export function getDb(): { db: any, adapter: ReturnType<typeof getDatabaseAdapter> } {
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
