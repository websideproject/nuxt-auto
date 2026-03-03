import type { H3Event } from 'h3'
import { getQuery, getRouterParams } from 'h3'
import type { HandlerContext, AuthUser } from '../../types'

/**
 * Build handler context from H3 event
 */
export async function buildContext(
  event: H3Event,
  options: {
    db: any
    schema: any
    resource: string
    operation: HandlerContext['operation']
  }
): Promise<HandlerContext> {
  const query = getQuery(event)
  const params = getRouterParams(event)

  // User will be populated by authentication middleware
  const user: AuthUser | null = (event.context.user as AuthUser) || null
  const permissions: string[] = user?.permissions || []

  const context: HandlerContext = {
    db: options.db,
    schema: options.schema,
    user,
    permissions,
    params,
    query,
    validated: {},
    event,
    resource: options.resource,
    operation: options.operation,
  }

  return context
}
