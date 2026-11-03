import type { H3Event } from 'h3'
import type { HandlerContext } from './index'
import type { DatabaseAdapter } from './database'

/**
 * Extended context with typed body and query for custom endpoints
 */
export interface EndpointContext<TBody = any, TQuery = any> extends HandlerContext {
  /** Validated and typed request body */
  body: TBody
  /** Validated and typed query parameters */
  queryParams: TQuery
  /** Database adapter */
  adapter: DatabaseAdapter
}

/**
 * Response format options
 */
export type ResponseFormat = 'auto' | 'raw'

/**
 * Options for createEndpoint
 */
export interface EndpointOptions<TBody = any, TQuery = any, TResponse = any> {
  /** Resource name (if tied to a registered resource for auth/validation) */
  resource?: string
  /** Operation type for authorization */
  operation?: HandlerContext['operation']
  /** Zod schema for body validation */
  body?: any // ZodType
  /** Zod schema for query validation */
  query?: any // ZodType
  /** Skip authorization check */
  skipAuthorization?: boolean
  /**
   * Skip the resource's query validation. The request BODY is never validated against the resource's table
   * schema — declare `body` with your own schema (validated before the handler; result in `ctx.body`).
   */
  skipValidation?: boolean
  /**
   * Name of this endpoint, matched against `ResourceAuthConfig.custom[endpointName]`.
   * When set the framework checks `custom[endpointName].permissions[operation]` (from the
   * module default, overridable from nuxt.config) as a collection-level gate — before the
   * `authorize` object-level callback.
   */
  endpointName?: string
  /**
   * The capability an API token's scope must cover for this endpoint (`<resource>:<scope>`), in place of the one its
   * `operation` implies (`list` / `get` → `read`, otherwise the operation). For an endpoint whose HTTP method and
   * operation say "write" but which only reads, so a read-only token (`*:read`) may call it:
   * @example
   * ```ts
   * createEndpoint({ resource: 'reports', operation: 'create', scope: 'read', handler: … }) // POST /api/reports/query
   * ```
   * A scope for the endpoint's named gate (`<resource>:<endpointName>`) still passes as well.
   */
  scope?: string
  /**
   * Custom object-level authorization. Called after the middleware pipeline and Zod
   * validation, but before the handler. Return false (or throw) to reject with 403.
   *
   * Use this to check object ownership without duplicating the resource's objectLevel logic:
   * @example
   * ```ts
   * authorize: async (ctx) => {
   *   const hook = await ctx.db.query.webhooks.findFirst({ where: eq(webhooks.id, ctx.params.id) })
   *   return ctx.objectLevelCheck ? ctx.objectLevelCheck(hook, ctx) : true
   * }
   * ```
   */
  authorize?: (context: EndpointContext<TBody, TQuery>, event: H3Event) => boolean | Promise<boolean>
  /** Request handler */
  handler: (context: EndpointContext<TBody, TQuery>, event: H3Event) => Promise<TResponse> | TResponse
  /** Transform the result before sending response */
  transform?: (data: TResponse, context: EndpointContext<TBody, TQuery>) => any
  /** Response format: 'auto' wraps in { data }, 'raw' passes through */
  responseFormat?: ResponseFormat
  /**
   * Remove hidden fields (`hiddenFields`, anywhere in the payload) and the fields the caller may not read
   * (`fields[x].read`, on the returned row or rows) from the handler's result, as the generated routes do.
   * @default true for a resource-bound endpoint, false for a standalone one
   */
  filterResponse?: boolean
}
