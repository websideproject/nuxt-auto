import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin, ContextExtender } from '../types/plugin'
import type { AuthUser } from '../types'

export interface BetterAuthPluginOptions {
  /**
   * Custom session extraction function.
   * If not provided, defaults to reading `event.context.user` (Better Auth convention).
   */
  getSession?: (event: any) => Promise<{ user: any; session: any } | null>
  /**
   * Map a Better Auth user to the AutoApi AuthUser shape.
   * If not provided, uses the user object directly.
   */
  mapUser?: (betterAuthUser: any) => AuthUser
  /**
   * Extract permissions from the user/session.
   * If not provided, reads `user.permissions` or `user.roles`.
   */
  getPermissions?: (user: any) => string[]
}

/**
 * Create a Better Auth integration plugin.
 * This does NOT register Better Auth routes - you do that yourself.
 * This plugin only extracts the session/user into HandlerContext on each request.
 *
 * @example
 * ```ts
 * import { createBetterAuthPlugin } from 'nuxt-auto-api/plugins'
 *
 * export default defineNuxtConfig({
 *   autoApi: {
 *     plugins: [
 *       createBetterAuthPlugin({
 *         getSession: async (event) => {
 *           const { auth } = useRuntimeConfig()
 *           return await auth.api.getSession({ headers: event.headers })
 *         },
 *         mapUser: (u) => ({ id: u.id, email: u.email, roles: [u.role] }),
 *       })
 *     ]
 *   }
 * })
 * ```
 */
export function createBetterAuthPlugin(options: BetterAuthPluginOptions = {}): AutoApiPlugin {
  const { getSession, mapUser, getPermissions } = options

  return defineAutoApiPlugin({
    name: 'better-auth',
    version: '1.0.0',
    runtimeSetup(ctx) {
      const extender: ContextExtender = async (context) => {
        // Skip if user is already set (e.g., by another plugin or middleware)
        if (context.user) return

        let sessionData: { user: any; session: any } | null = null

        if (getSession) {
          sessionData = await getSession(context.event)
        } else {
          // Default: read from event.context (Better Auth convention)
          const eventUser = (context.event.context as any).user
          if (eventUser) {
            sessionData = { user: eventUser, session: (context.event.context as any).session }
          }
        }

        if (!sessionData?.user) return

        // Map user
        const user: AuthUser = mapUser
          ? mapUser(sessionData.user)
          : {
              id: sessionData.user.id,
              email: sessionData.user.email,
              roles: sessionData.user.roles || (sessionData.user.role ? [sessionData.user.role] : []),
              permissions: sessionData.user.permissions || [],
            }

        // Extract permissions
        const permissions = getPermissions
          ? getPermissions(sessionData.user)
          : (user.permissions || [])

        context.user = user
        context.permissions = permissions
      }

      ctx.extendContext(extender)
      ctx.logger.info('Better Auth integration enabled')
    },
  })
}
