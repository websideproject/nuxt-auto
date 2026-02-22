import { defineNuxtRouteMiddleware, navigateTo } from '#app'

/**
 * Admin authentication middleware
 * Checks if user has access to admin panel
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig()
  const adminPrefix = config.public.autoAdmin?.prefix || '/admin'

  // Only apply to admin routes
  if (!to.path.startsWith(adminPrefix)) {
    return
  }

  // Get access control function from module options
  // @ts-ignore
  const accessControl = config.autoAdmin?.access

  if (!accessControl) {
    // No access control configured, allow all
    return
  }

  // Get current user (implementation depends on auth system)
  // This is a placeholder - users should provide their own user fetching logic
  const user = useState('user', () => null)

  try {
    const hasAccess = await accessControl(user.value)

    if (!hasAccess) {
      // Redirect to login or home page
      return navigateTo('/login')
    }
  } catch (error) {
    console.error('[nuxt-auto-admin] Access control error:', error)
    return navigateTo('/login')
  }
})
