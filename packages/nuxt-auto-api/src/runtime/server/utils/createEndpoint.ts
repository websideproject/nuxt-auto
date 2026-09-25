import type { H3Event, EventHandler } from 'h3'
import { defineEventHandler, readBody, getQuery, createError } from 'h3'
import { createCallerContext, createContextFromRegistry } from '../handlers/createContextFromRegistry'
import { getDatabaseAdapter } from '../database'
import { getMiddlewareForStage } from '../plugins/pluginRegistry'
import { serializeResponse } from './serializeResponse'
import type { EndpointOptions, EndpointContext } from '../../types/endpoint'
import type { HandlerContext } from '../../types'
import type { MiddlewareStage } from '../../types/plugin'
import { permissionKeyFor } from '../middleware/authz'
import { evaluatePermission } from './permissions'

/**
 * Create a custom API endpoint with the full auto-api pipeline.
 *
 * @example
 * ```ts
 * // server/api/users/[id]/stats.get.ts
 * import { z } from 'zod'
 *
 * export default createEndpoint({
 *   resource: 'users',
 *   operation: 'get',
 *   query: z.object({ detailed: z.boolean().optional() }),
 *   async handler(ctx) {
 *     const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.params.id) })
 *     return { user, stats: { posts: 42 } }
 *   },
 *   responseFormat: 'auto', // wraps in { data: ... }
 * })
 * ```
 */
export function createEndpoint<TBody = any, TQuery = any, TResponse = any>(
  options: EndpointOptions<TBody, TQuery, TResponse>,
): EventHandler {
  return defineEventHandler(async (event: H3Event) => {
    let context: HandlerContext
    let runMiddleware: (stage: MiddlewareStage) => Promise<void>

    if (options.resource) {
      // Resource-bound endpoint: use full pipeline
      const operation = options.operation || inferOperation(event)

      // Temporarily set the resource in event context so createContextFromRegistry can find it
      if (!event.context.params) {
        event.context.params = {}
      }
      (event.context.params as any).__resource = options.resource

      const result = await createContextFromRegistry(event, operation)
      context = result.context
      runMiddleware = result.runMiddleware

      // Run middleware pipeline
      await runMiddleware('pre-auth')

      if (!options.skipAuthorization) {
        // A named custom gate (`authorization.custom[endpointName]`) decides the operations it declares —
        // which lets one endpoint open an operation the resource keeps closed (e.g. `create: false` on a
        // resource that exposes a /checkout action). An operation the gate does NOT declare falls back to
        // the resource's own gate, never to "allowed".
        const customGate = options.endpointName
          ? result.effectiveAuth?.custom?.[options.endpointName]?.permissions
          : undefined
        const customPerm = (customGate as any)?.[permissionKeyFor(context.operation)]

        if (customPerm !== undefined) {
          if (!await evaluatePermission(customPerm, context)) {
            throw createError({
              statusCode: context.user ? 403 : 401,
              message: context.user ? 'Forbidden' : 'Authentication required',
            })
          }
        }
        else {
          await result.authorize(context)
        }
      }

      await runMiddleware('post-auth')

      if (!options.skipValidation) {
        await result.validate(context)
      }
    }
    else {
      // Standalone endpoint (no `resource`): the caller is resolved (context extenders ran) but NOTHING is
      // authorized for you — gate it with `authorize`, or inside the handler. `ctx.schema` holds every
      // registered table.
      context = await createCallerContext(event, options.operation || inferOperation(event))

      // Create runMiddleware for standalone
      runMiddleware = async (stage: MiddlewareStage) => {
        const middlewares = getMiddlewareForStage(stage, undefined, context.operation)
        for (const mw of middlewares) {
          await mw.handler(context)
        }
      }

      await runMiddleware('pre-auth')
      await runMiddleware('post-auth')
    }

    // Custom body validation with Zod
    let body: TBody = undefined as any
    if (options.body) {
      const rawBody = await readBody(event).catch(() => null)
      const parseResult = options.body.safeParse(rawBody)
      if (!parseResult.success) {
        throw createError({
          statusCode: 400,
          message: 'Body validation failed',
          data: { errors: parseResult.error.issues },
        })
      }
      body = parseResult.data
    }

    // Custom query validation with Zod
    let queryParams: TQuery = context.query as any
    if (options.query) {
      const rawQuery = getQuery(event)
      const parseResult = options.query.safeParse(rawQuery)
      if (!parseResult.success) {
        throw createError({
          statusCode: 400,
          message: 'Query validation failed',
          data: { errors: parseResult.error.issues },
        })
      }
      queryParams = parseResult.data
    }

    // Build endpoint context
    const endpointContext: EndpointContext<TBody, TQuery> = {
      ...context,
      body,
      queryParams,
      adapter: context.adapter || getDatabaseAdapter(),
    }

    // Custom object-level authorization (runs after body/query are parsed)
    if (options.authorize) {
      const allowed = await options.authorize(endpointContext, event)
      if (!allowed) {
        throw createError({ statusCode: 403, message: 'Forbidden' })
      }
    }

    await runMiddleware('pre-execute')

    // Execute handler
    let result = await options.handler(endpointContext, event)

    // Apply transform
    if (options.transform) {
      result = options.transform(result, endpointContext)
    }

    await runMiddleware('post-execute')

    // Format response
    const format = options.responseFormat || 'auto'
    if (format === 'auto') {
      return serializeResponse({ data: result })
    }

    return serializeResponse(result)
  })
}

function inferOperation(event: H3Event): HandlerContext['operation'] {
  switch (event.method) {
    case 'GET': return 'get'
    case 'POST': return 'create'
    case 'PATCH':
    case 'PUT': return 'update'
    case 'DELETE': return 'delete'
    default: return 'get'
  }
}
