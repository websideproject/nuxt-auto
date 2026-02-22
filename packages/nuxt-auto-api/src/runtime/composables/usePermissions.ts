import { useQuery } from '@tanstack/vue-query'
import type { UseQueryOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { PermissionQueryResponse, PermissionCheckResult } from '../types'

interface AllPermissionsResponse {
  user: any
  permissions: Record<string, PermissionCheckResult>
}

/**
 * Query permission information for ALL resources (global endpoint)
 * More efficient than querying each resource individually
 * This fetches all permissions in a single request and caches them
 *
 * @example
 * const { permissions } = useAllPermissions()
 * const canCreatePosts = permissions.value?.posts?.canCreate
 */
export function useAllPermissions(
  options?: Omit<UseQueryOptions<AllPermissionsResponse>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: async () => {
      const response = await $fetch<AllPermissionsResponse>('/api/permissions')
      return response
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    ...options,
  } as any)
}

/**
 * Query permission information for a specific resource
 * Uses the global permissions endpoint for better caching
 *
 * @example
 * const { canCreate, canRead, canUpdate, canDelete } = usePermissions('posts')
 *
 * @example
 * // With field-level permissions
 * const { permissions, canCreate } = usePermissions('users')
 * const canEditEmail = permissions.value?.fields?.email?.canWrite
 */
export function usePermissions(
  resource: MaybeRef<string>,
  options?: Omit<UseQueryOptions<PermissionCheckResult>, 'queryKey' | 'queryFn'> & {
    /**
     * Use the per-resource endpoint instead of the global one
     * Set to true if you only need permissions for this specific resource
     */
    individual?: boolean
  },
) {
  const resourceRef = computed(() => unref(resource))

  // Use individual endpoint if requested
  if (options?.individual) {
    const query = useQuery({
      queryKey: computed(() => ['permissions', resourceRef.value]),
      queryFn: async () => {
        const response = await $fetch<PermissionQueryResponse>(
          `/api/${resourceRef.value}/permissions`,
        )
        return response
      },
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      ...options,
    } as any)

    const canCreate = computed(() => query.data.value?.canCreate ?? false)
    const canRead = computed(() => query.data.value?.canRead ?? false)
    const canUpdate = computed(() => query.data.value?.canUpdate ?? false)
    const canDelete = computed(() => query.data.value?.canDelete ?? false)

    return {
      ...query,
      permissions: computed(() => query.data.value),
      canCreate,
      canRead,
      canUpdate,
      canDelete,
    }
  }

  // Use global endpoint and extract this resource's permissions
  const allPermissions = useAllPermissions(options)

  const resourcePermissions = computed(() => {
    return allPermissions.data.value?.permissions?.[resourceRef.value]
  })

  const canCreate = computed(() => resourcePermissions.value?.canCreate ?? false)
  const canRead = computed(() => resourcePermissions.value?.canRead ?? false)
  const canUpdate = computed(() => resourcePermissions.value?.canUpdate ?? false)
  const canDelete = computed(() => resourcePermissions.value?.canDelete ?? false)

  return {
    ...allPermissions,
    permissions: resourcePermissions,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
  }
}
