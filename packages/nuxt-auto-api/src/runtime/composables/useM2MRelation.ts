import { computed, unref } from 'vue'
import { useTrackedQuery } from './ssrQuery'
import type { UseQueryOptions, UseQueryReturnType } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { M2MListResponse, M2MListQuery } from '../types'
import { autoApiKeys } from './queryKeys'
import { prerenderSafeEnabled } from './prerenderEnabled'
import { useAutoApiPath } from './autoApiPath'
import { useAutoApiFetch } from './autoApiFetch'

/**
 * Query M2M relations with TanStack Query
 *
 * Features:
 * - Automatic caching (5-minute stale time)
 * - Auto-refetch on window focus
 * - Optimistic updates via mutations
 *
 * @example
 * const { data, isLoading, error } = useM2MRelation(
 *   'articles',
 *   articleId,
 *   'categories',
 *   { includeRecords: true, fields: ['id', 'name'] }
 * )
 */
export function useM2MRelation<T = any>(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  relation: MaybeRef<string>,
  params?: MaybeRef<M2MListQuery | undefined>,
  options?: Omit<UseQueryOptions<M2MListResponse<T>>, 'queryKey' | 'queryFn'>,
) {
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const idRef = computed(() => unref(id))
  const relationRef = computed(() => unref(relation))
  const paramsRef = computed(() => unref(params) || {})

  // Build query string
  const queryParams = computed(() => {
    const p = paramsRef.value
    const result: Record<string, any> = {}

    if (p.includeRecords !== undefined) {
      result.includeRecords = p.includeRecords
    }
    if (p.includeMetadata !== undefined) {
      result.includeMetadata = p.includeMetadata
    }
    if (p.fields) {
      result.fields = Array.isArray(p.fields) ? p.fields.join(',') : p.fields
    }
    if (p.filter) {
      result.filter = JSON.stringify(p.filter)
    }
    if (p.sort) {
      result.sort = Array.isArray(p.sort) ? p.sort.join(',') : p.sort
    }
    if (p.limit !== undefined) {
      result.limit = p.limit
    }
    if (p.offset !== undefined) {
      result.offset = p.offset
    }

    return result
  })

  return useTrackedQuery({
    queryKey: computed(() =>
      autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationRef.value, paramsRef.value),
    ),
    queryFn: async () => {
      const response = await fetcher<M2MListResponse<T>>(
        path(resourceRef.value, idRef.value, 'relations', relationRef.value),
        { query: queryParams.value },
      )
      return response
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
    enabled: prerenderSafeEnabled((options as any)?.enabled, () => !!idRef.value && !!relationRef.value),
  } as any) as UseQueryReturnType<M2MListResponse<T>, Error>
}
