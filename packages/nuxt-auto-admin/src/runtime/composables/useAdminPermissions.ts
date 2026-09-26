import { computed, unref, type MaybeRef } from 'vue'
import { usePermissions, useRecordPermissions } from '@websideproject/nuxt-auto-api/composables'

/**
 * Composable for checking permissions in admin UI
 * Wraps the auto-api usePermissions composable with admin-specific logic
 */
export function useAdminPermissions(resource: MaybeRef<string>) {
  const resourceRef = computed(() => unref(resource))

  // Use the global permissions endpoint for better caching
  const {
    permissions,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    isLoading,
  } = usePermissions(resourceRef)

  // Helper to check if any action is allowed
  const hasAnyPermission = computed(() => {
    return canCreate.value || canRead.value || canUpdate.value || canDelete.value
  })

  // Helper to get permission denied message
  const getPermissionDeniedMessage = (action: 'create' | 'read' | 'update' | 'delete') => {
    return `You don't have permission to ${action} ${resourceRef.value}`
  }

  return {
    permissions,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    hasAnyPermission,
    isLoading,
    getPermissionDeniedMessage,
  }
}

/**
 * Edit / Delete for specific rows: the resource permission AND the row's own rules (its visibility and the
 * resource's `objectLevel`). The resource-level `canUpdate` alone offers Edit on rows the API then refuses.
 * `false` until the API answers.
 */
export function useAdminRecordPermissions(resource: MaybeRef<string>, ids: () => Array<string | number>) {
  const { can, isLoading } = useRecordPermissions(resource, ids)
  return {
    canUpdateRow: (id: string | number) => can(id, 'update'),
    canDeleteRow: (id: string | number) => can(id, 'delete'),
    isLoading,
  }
}
