import { useRuntimeConfig } from '#app'
import type { AdminApiInfo, ModuleOptions } from '../types'

/** The admin options the module copies into `runtimeConfig.public.autoAdmin`. */
export type AdminPublicConfig = Pick<ModuleOptions, 'prefix' | 'branding' | 'features' | 'permissions' | 'customPages' | 'ui'> & {
  api?: AdminApiInfo
}

const API_DEFAULTS: AdminApiInfo = { maxLimit: 100, bulk: true, maxBatchSize: 100, export: null, auditLog: false }

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
    api: adminConfig.api || API_DEFAULTS,
  }
}
