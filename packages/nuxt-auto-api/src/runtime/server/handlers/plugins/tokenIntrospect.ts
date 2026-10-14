import { createError, defineEventHandler } from 'h3'
import { createCallerContext } from '../createContextFromRegistry'

/**
 * GET /api/_token/introspect — createApiTokenPlugin: the calling token's metadata (never its hash).
 * The module registers the route in every app; without the token plugin it answers 404.
 */
export default defineEventHandler(async (event) => {
  // The context extenders run here — the token plugin's one authenticates the Bearer token.
  const introspect = (globalThis as any).__apiTokenIntrospect
  if (!introspect) throw createError({ statusCode: 404, message: 'Not Found' })
  const context = await createCallerContext(event)
  return introspect({ ...context, resource: '_token', operation: 'get' })
})
