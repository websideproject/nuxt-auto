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
  /** Request handler */
  handler: (context: EndpointContext<TBody, TQuery>, event: H3Event) => Promise<TResponse> | TResponse
  /** Transform the result before sending response */
  transform?: (data: TResponse, context: EndpointContext<TBody, TQuery>) => any
  /** Response format: 'auto' wraps in { data }, 'raw' passes through */
  responseFormat?: ResponseFormat
}
