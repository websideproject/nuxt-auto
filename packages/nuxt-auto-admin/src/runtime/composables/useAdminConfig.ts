/**
 * Composable to access admin configuration
 */
export function useAdminConfig() {
  const config = useRuntimeConfig()
  const adminConfig = config.public.autoAdmin || {}

  return {
    prefix: adminConfig.prefix || '/admin',
    branding: adminConfig.branding || {},
    permissions: adminConfig.permissions || {
      unauthorizedButtons: 'disable',
      unauthorizedSidebarItems: 'hide',
    },
    features: adminConfig.features || {},
    ui: adminConfig.ui || {
      editMode: 'modal',
      viewMode: 'modal',
    },
  }
}
