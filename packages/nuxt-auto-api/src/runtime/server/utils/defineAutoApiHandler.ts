import type { H3Event, EventHandler } from 'h3'
import { defineEventHandler } from 'h3'
import { createContextFromRegistry } from '../handlers/createContextFromRegistry'
import type { HandlerContext } from '../../types'

export interface AutoApiHandlerOptions {
  /**
   * Custom execute logic that runs after auth/authz/validation
   */
  execute: (context: HandlerContext) => Promise<any> | any

  /**
   * Optional: Skip authorization for this handler
   */
  skipAuthorization?: boolean

  /**
   * Optional: Skip validation for this handler
   */
  skipValidation?: boolean

  /**
   * Optional: Custom transform for the result
   */
  transform?: (result: any, context: HandlerContext) => any
}

/**
 * @deprecated Use `createEndpoint()` instead for new code.
 *
 * Define a custom API handler that preserves auth/authz/validation pipeline
 * but allows custom execute logic.
 *
 * @example
 * // server/api/users/[id]/stats.get.ts
 * export default defineAutoApiHandler({
 *   async execute(context) {
 *     const userId = context.params.id
 *     return { userId, stats: { postCount: 10 } }
 *   }
 * })
 */
export function defineAutoApiHandler(
  options: AutoApiHandlerOptions
): EventHandler {
  return defineEventHandler(async (event: H3Event) => {
    // Extract resource from URL (e.g., /api/users/123/stats -> users)
    const path = event.path
    const parts = path.split('/').filter(Boolean)
    const apiIndex = parts.indexOf('api')
    const resource = parts[apiIndex + 1]

    // Determine operation from request method and path structure
    let operation: HandlerContext['operation'] = 'list'
    if (event.method === 'GET' && parts.length > apiIndex + 2) operation = 'get'
    else if (event.method === 'POST') operation = 'create'
    else if (event.method === 'PATCH' || event.method === 'PUT') operation = 'update'
    else if (event.method === 'DELETE') operation = 'delete'

    // Create context from registry
    const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, operation)

    // Override resource if needed (for custom endpoints)
    if (!context.resource) {
      context.resource = resource
    }

    await runMiddleware('pre-auth')

    // Run authorization unless skipped
    if (!options.skipAuthorization) {
      await authorize(context)
    }

    await runMiddleware('post-auth')

    // Run validation unless skipped
    if (!options.skipValidation) {
      await validate(context)
    }

    await runMiddleware('pre-execute')

    // Execute custom logic
    let result = await options.execute(context)

    // Apply transform if provided
    if (options.transform) {
      result = options.transform(result, context)
    }

    await runMiddleware('post-execute')

    return result
  })
}
