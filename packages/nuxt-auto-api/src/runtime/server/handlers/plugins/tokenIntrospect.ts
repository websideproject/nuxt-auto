import { createError, defineEventHandler } from 'h3'
import { createCallerContext } from '../createContextFromRegistry'

/** GET /api/_token/introspect — createApiTokenPlugin: the calling token's metadata (never its hash). */
export default defineEventHandler(async (event) => {
  // The context extenders run here — the token plugin's one authenticates the Bearer token.
  const context = await createCallerContext(event)
  const introspect = (globalThis as any).__apiTokenIntrospect
  if (!introspect) throw createError({ statusCode: 500, message: 'API token plugin not initialized' })
  return introspect({ ...context, resource: '_token', operation: 'get' })
})
