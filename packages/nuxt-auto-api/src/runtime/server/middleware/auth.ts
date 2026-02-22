import { createError } from 'h3'
import type { HandlerContext, AuthUser } from '../../types'

/**
 * Authentication middleware
 * Calls the user-defined authentication hook via Nitro hooks
 */
export async function authenticate(context: HandlerContext): Promise<void> {
  const { event } = context

  // Call authentication hook if defined
  // Users can define this hook in their Nitro plugins
  try {
    // Check if authentication result is already in context
    if (event.context.user) {
      context.user = event.context.user as AuthUser
      context.permissions = event.context.user.permissions || []
      return
    }

    // If no user in context, authentication is not required
    // The authorization middleware will handle permission checks
  } catch (error: any) {
    throw createError({
      statusCode: 401,
      message: error.message || 'Authentication failed',
    })
  }
}

/**
 * Require authentication middleware
 * Throws error if user is not authenticated
 */
export async function requireAuth(context: HandlerContext): Promise<void> {
  await authenticate(context)

  if (!context.user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    })
  }
}
