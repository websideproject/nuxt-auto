import type { H3Event, EventHandler } from 'h3'
import { createError } from 'h3'
import type { HandlerContext, HandlerPipeline } from '../../types'
import { buildContext } from '../context'

/**
 * Create a handler with the full pipeline:
 * Request → [Auth] → [Authorization] → [Validation] → [LOGIC] → [Transform] → Response
 */
export function createHandler(
  resource: string,
  operation: HandlerContext['operation'],
  pipeline: HandlerPipeline,
  options: {
    db: any
    schema: any
  }
): EventHandler {
  return async (event: H3Event) => {
    try {
      // Build context
      const context = await buildContext(event, {
        db: options.db,
        schema: options.schema,
        resource,
        operation,
      })

      // Execute pipeline
      // 1. Authentication (if defined)
      if (pipeline.authenticate) {
        await pipeline.authenticate(context)
      }

      // 2. Authorization (if defined)
      if (pipeline.authorize) {
        await pipeline.authorize(context)
      }

      // 3. Validation (if defined)
      if (pipeline.validate) {
        await pipeline.validate(context)
      }

      // 4. Execute main logic
      let result = await pipeline.execute(context)

      // 5. Transform result (if defined)
      if (pipeline.transform) {
        result = await pipeline.transform(result, context)
      }

      return result
    } catch (error: any) {
      // Handle errors
      if (error.statusCode) {
        throw error
      }

      console.error(`Error in ${resource}.${operation}:`, error)

      throw createError({
        statusCode: 500,
        message: error.message || 'Internal server error',
      })
    }
  }
}

/**
 * Default authentication middleware
 * Checks for user authentication via Nitro hooks
 */
export async function defaultAuthenticate(context: HandlerContext): Promise<void> {
  // Authentication is handled via Nitro hooks in the module setup
  // This is a placeholder that can be overridden
}

/**
 * Default authorization middleware
 * Checks basic permissions
 */
export async function defaultAuthorize(context: HandlerContext): Promise<void> {
  // Authorization logic will be implemented in the authorization middleware
  // This is a placeholder
}

/**
 * Default validation middleware
 */
export async function defaultValidate(context: HandlerContext): Promise<void> {
  // Validation logic will be implemented in the validation middleware
  // This is a placeholder
}
