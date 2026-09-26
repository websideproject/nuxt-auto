import { useRuntimeConfig } from '#app'
import type { ModuleOptions } from '../types'

/** The admin options the module copies into `runtimeConfig.public.autoAdmin`. */
export type AdminPublicConfig = Pick<ModuleOptions, 'prefix' | 'branding' | 'features' | 'permissions' | 'customPages' | 'ui'>

/**
 * Composable to access admin configuration
 */
export function useAdminConfig() {
  const config = useRuntimeConfig()
  // Typed from the module options: the generated runtime-config type is inferred from one app's values.
  const adminConfig = ((config.public as Record<string, unknown>).autoAdmin || {}) as AdminPublicConfig

  return {
    prefix: adminConfig.prefix || '/admin',
    branding: adminConfig.branding || {},
    permissions: adminConfig.permissions || {
      unauthorizedButtons: 'disable',
      unauthorizedSidebarItems: 'hide',
    },
    features: adminConfig.features || {},
    customPages: adminConfig.customPages || [],
    ui: adminConfig.ui || {
      editMode: 'modal',
      viewMode: 'modal',
    },
  }
}
