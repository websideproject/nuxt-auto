import type { ResourceAuthConfig } from '../../../packages/nuxt-auto-api/src/runtime/types'

/**
 * Authorization for API keys.
 * - Authenticated users can list/create their own keys
 * - Object-level check restricts access to own keys (admins see all)
 * - Only admins can delete other users' keys
 */
export const apiKeysAuth: ResourceAuthConfig = {
  permissions: {
    read: (ctx) => !!ctx.user,
    create: (ctx) => !!ctx.user,
    update: (ctx) => !!ctx.user,
    delete: (ctx) => !!ctx.user,
  },
  objectLevel: async (object, ctx) => {
    if (ctx.user?.role === 'admin') return true
    return ctx.user && String(object.userId) === String(ctx.user.id)
  },
}
