import { useQuery } from '@tanstack/vue-query'
import type { UseQueryOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { M2MListResponse, M2MListQuery } from '../types'
import { autoApiKeys } from './queryKeys'

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
  params?: MaybeRef<M2MListQuery>,
  options?: Omit<UseQueryOptions<M2MListResponse<T>>, 'queryKey' | 'queryFn'>
) {
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

  return useQuery({
    queryKey: computed(() =>
      autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationRef.value, paramsRef.value)
    ),
    queryFn: async () => {
      const response = await $fetch<M2MListResponse<T>>(
        `/api/${resourceRef.value}/${idRef.value}/relations/${relationRef.value}`,
        { query: queryParams.value }
      )
      return response
    },
    enabled: computed(() => !!idRef.value && !!relationRef.value),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  } as any)
}
