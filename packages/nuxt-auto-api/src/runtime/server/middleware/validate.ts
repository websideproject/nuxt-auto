import { createError, readBody } from 'h3'
import { z } from 'zod'
import type { HandlerContext, ValidationSchema } from '../../types'
import { generateQuerySchema } from '../validation/schemaGenerator'

const isZodError = (e: any) => e instanceof z.ZodError || e?.name === 'ZodError'

function validationError(issues: any[]): never {
  throw createError({ statusCode: 400, message: 'Validation error', data: { errors: issues } })
}

/** The parsed value, or the issues (paths prefixed) when `value` does not match. */
async function check(schema: z.ZodType<any> | undefined, value: any, pathPrefix: Array<string | number> = []): Promise<{ data?: any, issues?: any[] }> {
  if (!schema) return { data: value }
  try {
    return { data: await schema.parseAsync(value) }
  }
  catch (error: any) {
    if (!isZodError(error)) throw error
    return { issues: error.issues.map((i: any) => ({ ...i, path: [...pathPrefix, ...i.path] })) }
  }
}

async function parse(schema: z.ZodType<any> | undefined, value: any, pathPrefix: Array<string | number> = []) {
  const { data, issues } = await check(schema, value, pathPrefix)
  if (issues) validationError(issues)
  return data
}

/**
 * Validation middleware. Validates the query string for every operation, and the body for create/update:
 * one object, or — for bulk routes (`context.bulk`) — `{ items: [...] }`, each item against the same
 * schema (bulk update items are `{ id, data }`, and `data` is what is validated).
 *
 * `schemas` may be a getter so the schema is resolved per request (tenant-aware omissions).
 */
export function createValidationMiddleware(schemas?: ValidationSchema | (() => ValidationSchema)) {
  /** `body: false` validates the query only (custom endpoints — see `createEndpoint`). */
  return async (context: HandlerContext, options?: { body?: boolean }) => {
    const s = typeof schemas === 'function' ? schemas() : schemas
    // A JSON `?filter=` arrives as a string; parse it first so a custom query schema can declare an object.
    // (Malformed JSON is left as-is — the handler answers it with a 400.)
    if (typeof context.query?.filter === 'string') {
      try {
        context.query.filter = JSON.parse(context.query.filter)
      }
      catch {
        // left as-is: the handler answers malformed JSON with a 400
      }
    }
    context.validated.query = await parse(s?.query ?? generateQuerySchema(), context.query)

    const { operation } = context
    if (options?.body === false) return
    if (operation !== 'create' && operation !== 'update' && !(context.bulk && operation === 'delete')) return

    let body: any
    try {
      body = await readBody(context.event)
    }
    catch (error: any) {
      if (error?.statusCode) throw error
      throw createError({ statusCode: 400, message: 'Request body is not valid JSON' })
    }

    if (!context.bulk) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw createError({ statusCode: 400, message: 'Request body must be a JSON object' })
      }
      context.validated.body = await parse(operation === 'create' ? s?.create : s?.update, body)
      return
    }

    if (operation === 'delete') {
      if (!body || !Array.isArray(body.ids)) throw createError({ statusCode: 400, message: 'Request body must contain an "ids" array' })
      context.validated.body = { ids: body.ids }
      return
    }

    if (!body || !Array.isArray(body.items)) {
      throw createError({ statusCode: 400, message: 'Request body must contain an "items" array' })
    }
    // Every item is checked, and every invalid one is reported — not only the first.
    const items: any[] = []
    const issues: any[] = []
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i]
      if (operation === 'create') {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          issues.push({ path: ['items', i], message: 'Item must be an object' })
          continue
        }
        const result = await check(s?.create, item, ['items', i])
        if (result.issues) issues.push(...result.issues)
        else items.push(result.data)
      }
      else {
        if (!item || item.id === undefined || item.id === null || !item.data || typeof item.data !== 'object') {
          issues.push({ path: ['items', i], message: 'Item must be { id, data }' })
          continue
        }
        const result = await check(s?.update, item.data, ['items', i, 'data'])
        if (result.issues) issues.push(...result.issues)
        else items.push({ id: item.id, data: result.data })
      }
    }
    if (issues.length) validationError(issues)
    context.validated.body = { items }
  }
}

/** Validation with generated query validation only (no body schemas). */
export async function defaultValidate(context: HandlerContext): Promise<void> {
  await createValidationMiddleware()(context)
}
