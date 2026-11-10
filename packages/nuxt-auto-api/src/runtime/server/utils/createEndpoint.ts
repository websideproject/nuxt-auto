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
import { evaluatePermission, scopeRule } from './permissions'
import { findAuthorizedRow } from './rowAccess'
import { filterHiddenFields } from './filterHiddenFields'
import { filterReadableFields } from './fieldPermissions'
import { conflictFromUniqueViolation } from './uniqueViolation'

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
 *   row: 'id', // loads ctx.row: missing or hidden 404, `objectLevel` 403
 *   query: z.object({ detailed: z.boolean().optional() }),
 *   async handler(ctx) {
 *     return { user: ctx.row, stats: { posts: 42 } }
 *   },
 *   responseFormat: 'auto', // wraps in { data: ... }
 * })
 * ```
 */
export function createEndpoint<TBody = any, TQuery = any, TResponse = any>(
  options: EndpointOptions<TBody, TQuery, TResponse>,
): EventHandler {
  // Wrong at the first request of every caller, so wrong at startup instead.
  if (options.row && !options.resource) throw new Error('createEndpoint: `row` needs a `resource`, the table it loads from')
  if (options.scope && !options.resource && !options.scope.includes(':')) {
    throw new Error(`createEndpoint: with no \`resource\`, \`scope\` names the whole permission ("reports:${options.scope}"), not "${options.scope}"`)
  }

  /** The answer to a caller who failed the permission check. */
  const refuse = (context: HandlerContext, message: string) => createError({
    statusCode: context.user ? 403 : 401,
    message: context.user ? (options.refusal ?? message) : 'Authentication required',
  })

  return defineEventHandler(async (event: H3Event) => {
    let context: HandlerContext
    let runMiddleware: (stage: MiddlewareStage) => Promise<void>

    if (options.resource) {
      // Resource-bound endpoint: use full pipeline
      const operation = options.operation || inferOperation(event)

      const result = await createContextFromRegistry(event, operation, { resource: options.resource })
      context = result.context
      runMiddleware = result.runMiddleware

      // Every route param (`[slug]`, `[orgId]`, …), not only `id` / `relation`.
      context.params = { ...(event.context.params as Record<string, string> | undefined), ...context.params }
      if (options.endpointName) context.endpointName = options.endpointName
      if (options.scope) context.endpointScope = options.scope

      // Run middleware pipeline
      await runMiddleware('pre-auth')

      if (!options.skipAuthorization) {
        // A named custom gate (`authorization.custom[endpointName]`) decides the operations it declares —
        // which lets one endpoint open an operation the resource keeps closed (e.g. `create: false` on a
        // resource that exposes a /checkout action). An operation the gate does NOT declare falls back to
        // `scope`, then to the resource's own gate, never to "allowed".
        const customGate = options.endpointName
          ? result.effectiveAuth?.custom?.[options.endpointName]?.permissions
          : undefined
        const customPerm = (customGate as any)?.[permissionKeyFor(context.operation)]

        if (customPerm !== undefined) {
          if (!await evaluatePermission(customPerm, context)) throw refuse(context, 'Forbidden')
        }
        else if (options.scope) {
          if (!await evaluatePermission(scopeRule(options.scope, result.effectiveAuth, options.resource), context)) {
            throw refuse(context, `Forbidden: you don't have permission to ${options.scope} ${options.resource}`)
          }
        }
        else {
          // The operation's own gate. Its 403 is worded by `refusal` when the endpoint has one.
          try {
            await result.authorize(context)
          }
          catch (error: any) {
            throw options.refusal && error?.statusCode === 403 ? refuse(context, 'Forbidden') : error
          }
        }
      }

      // The resource's row rules, for the handler's own queries, whichever check above ran.
      if (result.effectiveAuth?.objectLevel) context.objectLevelCheck = result.effectiveAuth.objectLevel
      if (result.effectiveAuth?.listFilter) context.listFilter = result.effectiveAuth.listFilter

      await runMiddleware('post-auth')

      // The resource's QUERY schema applies (filters, paging). Its BODY schema does not: it describes a table
      // row, and a custom endpoint's body is its own shape — declare it with `body`. Validating against the row
      // 400'd every `create` endpoint whose body lacked the table's required columns (an import, a duplicate,
      // a checkout), which is why `skipValidation: true` ended up on almost every endpoint.
      if (!options.skipValidation) {
        await result.validate(context, { body: false })
      }
    }
    else {
      // Standalone endpoint (no `resource`): the caller is resolved (context extenders ran) but nothing is
      // authorized for you, except a `scope` — gate it with `scope`, `authorize` or inside the handler. `ctx.schema`
      // holds every registered table.
      context = await createCallerContext(event, options.operation || inferOperation(event))
      if (options.scope) context.endpointScope = options.scope

      // Create runMiddleware for standalone
      runMiddleware = async (stage: MiddlewareStage) => {
        const middlewares = getMiddlewareForStage(stage, undefined, context.operation)
        for (const mw of middlewares) {
          await mw.handler(context)
        }
      }

      await runMiddleware('pre-auth')
      if (options.scope && !options.skipAuthorization && !await evaluatePermission(options.scope, context)) {
        throw refuse(context, `Forbidden: you don't have permission for ${options.scope}`)
      }
      await runMiddleware('post-auth')
    }

    // Signed-in callers only, whatever else decides (or with `skipAuthorization`, nothing else).
    if (options.requireUser && !context.user) {
      throw createError({ statusCode: 401, message: 'Authentication required' })
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

    // The row the route names: the same answers as GET /api/<resource>/:id (not visible or missing 404, `objectLevel` 403).
    if (options.row) {
      const id = (context.params as Record<string, string | undefined>)[options.row]
      if (!id) throw createError({ statusCode: 400, message: `Route parameter "${options.row}" is required` })
      endpointContext.row = await findAuthorizedRow(context, options.resource!, id).catch((e: any) => {
        // A person reads these: the resource's name stays out of a 404.
        if (e?.statusCode === 404) throw createError({ statusCode: 404, message: 'Not found' })
        throw e?.statusCode === 403 && options.refusal ? createError({ statusCode: 403, message: options.refusal }) : e
      })
    }

    // Custom object-level authorization (runs after body/query are parsed)
    if (options.authorize) {
      const allowed = await options.authorize(endpointContext, event)
      if (!allowed) {
        throw createError({ statusCode: 403, message: options.refusal ?? 'Forbidden' })
      }
    }

    const format = (data: any) => {
      if ((options.responseFormat || 'auto') === 'auto') return serializeResponse({ data })
      // `raw`: a Response, stream or Blob is sent as is (serializing would turn it into `{}`).
      return data instanceof Date || isJsonData(data) || data === null || typeof data !== 'object' ? serializeResponse(data) : data
    }

    await runMiddleware('pre-execute')

    // A pre-execute middleware (e.g. a cache hit) answered the request: skip the handler.
    if (context.shortCircuit) {
      await runMiddleware('post-execute')
      return format(context.shortCircuit.data)
    }

    // Execute handler. A duplicate unique value is the client's conflict (409), as on the generated routes.
    let result: any
    try {
      result = await options.handler(endpointContext, event)
    }
    catch (error) {
      throw conflictFromUniqueViolation(error, options.resource ? context.schema?.[options.resource] : undefined)
    }

    // Apply transform
    if (options.transform) {
      result = options.transform(result, endpointContext)
    }

    // Leave out hidden fields (anywhere in the payload) and the fields the caller may not read (on the row or rows
    // returned), as the generated routes do. Only JSON data: a Response, stream or Blob is passed through as is.
    if ((options.filterResponse ?? !!options.resource) && isJsonData(result)) {
      result = await filterReadableFields(filterHiddenFields(result as any, context) as any, context) as any
    }

    context.result = result
    await runMiddleware('post-execute')

    return format(result)
  })
}

function isJsonData(value: unknown): boolean {
  if (Array.isArray(value)) return true
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
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
