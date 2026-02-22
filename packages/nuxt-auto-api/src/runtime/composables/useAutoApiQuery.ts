import { useQuery, useInfiniteQuery } from '@tanstack/vue-query'
import type { UseQueryOptions, UseInfiniteQueryOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'

export interface ListQueryParams {
  filter?: Record<string, any>
  sort?: string | string[]
  page?: number
  limit?: number
  cursor?: string
  include?: string | string[]
  fields?: string | string[]
}

export interface ListResponse<T> {
  data: T[]
  meta?: {
    page?: number
    limit?: number
    total?: number
    nextCursor?: string
    hasMore?: boolean
  }
}

export interface GetResponse<T> {
  data: T
}

/**
 * Query a list of resources with TanStack Query
 *
 * @example
 * const { data, isLoading, error, refetch } = useAutoApiList('posts', {
 *   filter: { status: 'published' },
 *   sort: '-createdAt',
 *   include: 'author'
 * })
 */
export function useAutoApiList<T = any>(
  resource: MaybeRef<string>,
  params?: MaybeRef<ListQueryParams>,
  options?: Omit<UseQueryOptions<ListResponse<T>>, 'queryKey' | 'queryFn'>
) {
  const resourceRef = computed(() => unref(resource))
  const paramsRef = computed(() => unref(params) || {})

  // Serialize filter as JSON to preserve types (numbers, booleans)
  const queryParams = computed(() => {
    const params = paramsRef.value
    if (!params) return {}

    const result: Record<string, any> = { ...params }

    // Serialize filter object as JSON string
    if (params.filter && typeof params.filter === 'object') {
      result.filter = JSON.stringify(params.filter)
    }

    return result
  })

  return useQuery({
    queryKey: computed(() => ['autoapi', resourceRef.value, 'list', paramsRef.value]),
    queryFn: async () => {
      const response = await $fetch<ListResponse<T>>(`/api/${resourceRef.value}`, {
        query: queryParams.value as any
      })
      return response
    },
    ...options
  } as any)
}

/**
 * Query a single resource by ID with TanStack Query
 *
 * @example
 * const { data, isLoading, error } = useAutoApiGet('posts', postId, {
 *   include: 'author,comments'
 * })
 */
export function useAutoApiGet<T = any>(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  params?: MaybeRef<Pick<ListQueryParams, 'include' | 'fields'>>,
  options?: Omit<UseQueryOptions<GetResponse<T>>, 'queryKey' | 'queryFn'>
) {
  const resourceRef = computed(() => unref(resource))
  const idRef = computed(() => unref(id))
  const paramsRef = computed(() => unref(params) || {})

  return useQuery({
    queryKey: computed(() => ['autoapi', resourceRef.value, 'get', idRef.value, paramsRef.value]),
    queryFn: async () => {
      const response = await $fetch<GetResponse<T>>(
        `/api/${resourceRef.value}/${idRef.value}`,
        { query: paramsRef.value as any }
      )
      return response
    },
    enabled: computed(() => !!idRef.value),
    ...options
  } as any)
}

/**
 * Infinite scroll query with TanStack Query
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useAutoApiInfinite('posts', {
 *   limit: 20,
 *   sort: '-createdAt'
 * })
 */
export function useAutoApiInfinite<T = any>(
  resource: MaybeRef<string>,
  params?: MaybeRef<Omit<ListQueryParams, 'cursor'>>,
  options?: Omit<UseInfiniteQueryOptions<ListResponse<T>>, 'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'>
) {
  const resourceRef = computed(() => unref(resource))
  const paramsRef = computed(() => unref(params) || {})

  return useInfiniteQuery({
    queryKey: computed(() => ['autoapi', resourceRef.value, 'infinite', paramsRef.value]),
    queryFn: async ({ pageParam }) => {
      const params = paramsRef.value
      const queryParams: Record<string, any> = { ...params }

      // Serialize filter object as JSON string
      if (params.filter && typeof params.filter === 'object') {
        queryParams.filter = JSON.stringify(params.filter)
      }

      // Add cursor
      if (pageParam) {
        queryParams.cursor = pageParam
      }

      const response = await $fetch<ListResponse<T>>(`/api/${resourceRef.value}`, {
        query: queryParams as any
      })
      return response
    },
    getNextPageParam: (lastPage) => {
      return lastPage.meta?.nextCursor
    },
    initialPageParam: undefined,
    ...options
  } as any)
}
