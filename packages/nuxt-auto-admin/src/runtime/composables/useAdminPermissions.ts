import { computed, type MaybeRef } from 'vue'

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
