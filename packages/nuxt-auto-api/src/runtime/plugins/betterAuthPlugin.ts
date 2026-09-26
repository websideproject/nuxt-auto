import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin, ContextExtender } from '../types/plugin'
import type { AuthUser } from '../types'

export interface BetterAuthPluginOptions {
  /**
   * Custom session extraction function.
   * If not provided, defaults to reading `event.context.user` (Better Auth convention).
   */
  getSession?: (event: any) => Promise<{ user: any, session: any } | null>
  /**
   * Map a Better Auth user to the AutoApi AuthUser shape. Receives the session too — the organization plugin
   * keeps `activeOrganizationId` on the SESSION, and multi-tenancy reads the tenant from
   * `user.organizationId` (`multiTenancy.userTenantField`), so a custom mapper must copy it across.
   * If not provided: `{ id, email, roles, permissions, organizationId: session.activeOrganizationId }`.
   */
  mapUser?: (betterAuthUser: any, session: any) => AuthUser
  /**
   * Extract permissions (the strings `permissions: { read: 'posts:read' }` matches) from the user/session.
   * If not provided, reads `user.permissions`.
   */
  getPermissions?: (user: any, session: any) => string[]
}

/**
 * Create a Better Auth integration plugin.
 * This does NOT register Better Auth routes - you do that yourself.
 * This plugin only extracts the session/user into HandlerContext on each request.
 *
 * @example
 * ```ts
 * // server/autoapi-plugins.ts   (nuxt.config: autoApi.plugins: '~/server/autoapi-plugins')
 * import { createBetterAuthPlugin } from '@websideproject/nuxt-auto-api/plugins'
 * import { auth } from './lib/auth'
 *
 * export default [
 *   createBetterAuthPlugin({
 *     getSession: event => auth.api.getSession({ headers: event.headers }),
 *     mapUser: (u, session) => ({ id: u.id, email: u.email, roles: [u.role], organizationId: session?.activeOrganizationId ?? null }),
 *   }),
 * ]
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

        let sessionData: { user: any, session: any } | null = null

        if (getSession) {
          sessionData = await getSession(context.event)
        }
        else {
          // Default: read from event.context (Better Auth convention)
          const eventUser = (context.event.context as any).user
          if (eventUser) {
            sessionData = { user: eventUser, session: (context.event.context as any).session }
          }
        }

        if (!sessionData?.user) return

        // Map user
        const user: AuthUser = mapUser
          ? mapUser(sessionData.user, sessionData.session)
          : {
              id: sessionData.user.id,
              email: sessionData.user.email,
              roles: sessionData.user.roles || (sessionData.user.role ? [sessionData.user.role] : []),
              permissions: sessionData.user.permissions || [],
              // The organization plugin keeps the active org on the SESSION; multi-tenancy reads it from the
              // user (`multiTenancy.userTenantField`, default `organizationId`).
              organizationId: sessionData.session?.activeOrganizationId ?? sessionData.user.organizationId ?? null,
            }

        // Extract permissions
        const permissions = getPermissions
          ? getPermissions(sessionData.user, sessionData.session)
          : (user.permissions || [])

        context.user = user
        context.permissions = permissions
      }

      ctx.extendContext(extender)
      ctx.logger.info('Better Auth integration enabled')
    },
  })
}
