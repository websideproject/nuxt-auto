/**
 * Global middleware to check permissions for admin routes
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig()
  const adminPrefix = config.public.autoAdmin?.prefix || '/admin'

  // Only apply to admin routes
  if (!to.path.startsWith(adminPrefix)) {
    return
  }

  // Skip for main admin page (dashboard)
  if (to.path === adminPrefix || to.path === `${adminPrefix}/`) {
    return
  }

  // Extract resource name from path: /admin/[resource]/...
  const pathParts = to.path.replace(adminPrefix, '').split('/').filter(Boolean)

  if (pathParts.length === 0) {
    return
  }

  const resourceOrPage = pathParts[0]

  // Check if this is a resource route
  const { getResource } = useAdminRegistry()
  const resource = getResource(resourceOrPage)

  if (resource) {
    // It's a resource - check permissions
    const { hasAnyPermission, isLoading } = useAdminPermissions(resourceOrPage)

    // Wait for permissions to load
    while (isLoading.value) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    if (!hasAnyPermission.value) {
      // No permission to access this resource
      return abortNavigation({
        statusCode: 403,
        statusMessage: `You don't have permission to access ${resource.displayName || resourceOrPage}`
      })
    }
  } else {
    // Check if it's a custom page
    const customPages = config.public.autoAdmin?.customPages || []
    const customPage = customPages.find((p: any) => {
      const pagePath = p.path.startsWith('/') ? p.path : `${adminPrefix}/${p.path}`
      return to.path === pagePath || to.path.startsWith(`${pagePath}/`)
    })

    if (customPage) {
      // Check custom page permissions
      if (customPage.canAccess) {
        // TODO: Get current user and pass to canAccess
        const hasAccess = await customPage.canAccess(null)
        if (!hasAccess) {
          return abortNavigation({
            statusCode: 403,
            statusMessage: `You don't have permission to access ${customPage.label}`
          })
        }
      } else if (customPage.permissions) {
        // TODO: Implement permission string/array checking
        // For now, allow access
      }
    }
  }
})
