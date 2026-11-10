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
  /** The row named by the route, when the endpoint declares `row` */
  row?: any
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
   * Answer 401 to a caller who is not signed in, before the body is read. For "any signed-in caller" endpoints
   * that act on the caller's own rows: `skipAuthorization: true, requireUser: true` replaces a hand-written check
   * in the handler. It adds to the permission check when that runs; it never replaces it.
   */
  requireUser?: boolean
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
   * The permission this endpoint is authorized by, for the person and for an API token, in place of the one its
   * `operation` implies. So an endpoint needs no permission code of its own.
   *
   * - `read`, `create`, `update`, `delete`: the resource's rule for it. A POST that only reads says `scope: 'read'`.
   * - any other word: the rule the resource's `permissions` declare for it, else the held string `<resource>:<word>`.
   * - a string with a colon: that permission, whatever the resource (the only form with no `resource`).
   *
   * A named gate that declares the operation still decides first. `skipAuthorization` leaves only the token's check.
   * @example
   * ```ts
   * createEndpoint({ resource: 'reports', scope: 'read', handler: … })       // POST /api/reports/query
   * createEndpoint({ resource: 'posts', scope: 'publish', row: 'id', handler: … }) // needs posts:publish
   * createEndpoint({ resource: 'apiKeys', scope: 'workspace:settings', handler: … })
   * ```
   */
  scope?: string
  /**
   * The route parameter that names a row of `resource`. The row is loaded before the handler, as `ctx.row`, with the
   * answers of `GET /api/<resource>/:id`: missing or not visible (tenant, `listFilter`, soft delete) 404, failing
   * `objectLevel` 403. `objectLevel` can read `ctx.endpointScope` to judge the row by the endpoint's permission.
   */
  row?: string
  /** What a signed-in caller is told when the permission check, `row`'s `objectLevel` or `authorize` refuses them. */
  refusal?: string
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
