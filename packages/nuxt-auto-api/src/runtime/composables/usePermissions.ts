import { useTrackedQuery } from './ssrQuery'
import type { UseQueryOptions } from '@tanstack/vue-query'
import { computed, toValue, unref } from 'vue'
import type { MaybeRef } from 'vue'
import type { PermissionQueryResponse, PermissionCheckResult } from '../types'
import { prerenderSafeEnabled } from './prerenderEnabled'
import { useAutoApiPath } from './autoApiPath'
import { useAutoApiFetch } from './autoApiFetch'

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
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  return useTrackedQuery<AllPermissionsResponse>({
    queryKey: ['permissions', 'all'],
    queryFn: () => fetcher<AllPermissionsResponse>(path('permissions')),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    ...options,
    enabled: prerenderSafeEnabled((options as any)?.enabled),
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
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))

  // Use individual endpoint if requested
  if (options?.individual) {
    const query = useTrackedQuery<PermissionQueryResponse>({
      queryKey: computed(() => ['permissions', resourceRef.value]),
      queryFn: () => fetcher<PermissionQueryResponse>(path(resourceRef.value, 'permissions')),
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      ...options,
      enabled: prerenderSafeEnabled((options as any)?.enabled),
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

/**
 * What the caller may do on specific rows — resource permissions AND row visibility AND the resource's
 * `objectLevel` rule — for enabling Edit / Delete per row. One request for all `ids`; unknown ids are `false`.
 *
 * @example
 * const { can } = useRecordPermissions('posts', () => rows.value.map(r => r.id))
 * // can(post.id, 'update')
 */
export function useRecordPermissions(
  resource: MaybeRef<string>,
  ids: MaybeRef<Array<string | number>> | (() => Array<string | number>),
  options?: Omit<UseQueryOptions<PermissionQueryResponse>, 'queryKey' | 'queryFn'>,
) {
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const idsRef = computed(() => [...new Set(toValue(ids).map(String))].sort())

  const query = useTrackedQuery<PermissionQueryResponse>({
    queryKey: computed(() => ['permissions', resourceRef.value, 'records', idsRef.value]),
    queryFn: () => fetcher<PermissionQueryResponse>(path(resourceRef.value, 'permissions'), { query: { ids: idsRef.value.join(',') } }),
    staleTime: 1000 * 60 * 5,
    ...options,
    enabled: prerenderSafeEnabled((options as any)?.enabled, () => idsRef.value.length > 0),
  } as any)

  const records = computed(() => query.data.value?.records ?? {})
  const can = (id: string | number, action: 'read' | 'update' | 'delete') => {
    const record = records.value[String(id)]
    return !!(record && record[action === 'read' ? 'canRead' : action === 'update' ? 'canUpdate' : 'canDelete'])
  }
  return { ...query, records, can }
}
