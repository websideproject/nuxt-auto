import type { ComputedRef } from 'vue'

type ButtonVariant = 'solid' | 'outline' | 'soft' | 'ghost' | 'link'

/**
 * Helper composable that wraps usePermissions with action-specific utilities
 * Provides convenience methods for button states and variants
 */
export function useResourceActions(resource: string) {
  const { canCreate, canRead, canUpdate, canDelete, permissions } = usePermissions(resource)

  /**
   * Get button variant based on whether action is allowed
   * Allowed actions get primary variant, disabled get soft variant
   */
  function getActionVariant(action: 'create' | 'read' | 'update' | 'delete'): ComputedRef<ButtonVariant> {
    return computed(() => {
      const allowed = {
        create: canCreate.value,
        read: canRead.value,
        update: canUpdate.value,
        delete: canDelete.value,
      }[action]

      return allowed ? 'solid' : 'soft'
    })
  }

  /**
   * Check if an action should be disabled
   */
  function isActionDisabled(action: 'create' | 'read' | 'update' | 'delete'): ComputedRef<boolean> {
    return computed(() => {
      const allowed = {
        create: canCreate.value,
        read: canRead.value,
        update: canUpdate.value,
        delete: canDelete.value,
      }[action]

      return !allowed
    })
  }

  /**
   * Get tooltip text explaining why action is disabled
   */
  function getActionTooltip(action: 'create' | 'read' | 'update' | 'delete'): ComputedRef<string | undefined> {
    return computed(() => {
      const allowed = {
        create: canCreate.value,
        read: canRead.value,
        update: canUpdate.value,
        delete: canDelete.value,
      }[action]

      if (allowed) {
        return undefined
      }

      const actionLabels = {
        create: 'create',
        read: 'view',
        update: 'edit',
        delete: 'delete',
      }

      return `You don't have permission to ${actionLabels[action]} this resource`
    })
  }

  return {
    permissions,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    getActionVariant,
    isActionDisabled,
    getActionTooltip,
  }
}
