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
  /** Skip validation check */
  skipValidation?: boolean
  /**
   * Name of this endpoint, matched against `ResourceAuthConfig.custom[endpointName]`.
   * When set the framework checks `custom[endpointName].permissions[operation]` (from the
   * module default, overridable from nuxt.config) as a collection-level gate — before the
   * `authorize` object-level callback.
   */
  endpointName?: string
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
}
