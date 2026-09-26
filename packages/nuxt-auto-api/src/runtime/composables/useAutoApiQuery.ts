import { computed, unref } from 'vue'
import { useTrackedQuery, useTrackedInfiniteQuery } from './ssrQuery'
import type { InfiniteData, UseInfiniteQueryOptions, UseInfiniteQueryReturnType, UseQueryOptions, UseQueryReturnType } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { prerenderSafeEnabled } from './prerenderEnabled'
import { useAutoApiPath } from './autoApiPath'
import { useAutoApiFetch } from './autoApiFetch'

export interface ListQueryParams {
  filter?: Record<string, any>
  sort?: string | string[]
  page?: number
  limit?: number
  cursor?: string
  include?: string | string[]
  fields?: string | string[]
  /** Simple aggregates over the same rows, returned in `meta.aggregates` (e.g. `'count,sum(total)'`). */
  aggregate?: string
  /** Include trashed rows (needs the `viewDeleted` permission). */
  includeDeleted?: boolean
  /** Only trashed rows (needs the `viewDeleted` permission). */
  onlyDeleted?: boolean
}

export interface ListResponse<T> {
  data: T[]
  meta: {
    page?: number
    limit?: number
    total?: number
    nextCursor?: string
    hasMore?: boolean
    aggregates?: Record<string, any>
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
  params?: MaybeRef<ListQueryParams | undefined>,
  options?: Omit<UseQueryOptions<ListResponse<T>>, 'queryKey' | 'queryFn'>,
) {
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
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

  return useTrackedQuery({
    queryKey: computed(() => ['autoapi', resourceRef.value, 'list', paramsRef.value]),
    queryFn: async () => {
      const response = await fetcher<ListResponse<T>>(path(resourceRef.value), {
        query: queryParams.value as any,
      })
      return response
    },
    ...options,
    enabled: prerenderSafeEnabled((options as any)?.enabled),
  } as any) as UseQueryReturnType<ListResponse<T>, Error>
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
  params?: MaybeRef<Pick<ListQueryParams, 'include' | 'fields'> | undefined>,
  options?: Omit<UseQueryOptions<GetResponse<T>>, 'queryKey' | 'queryFn'>,
) {
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const idRef = computed(() => unref(id))
  const paramsRef = computed(() => unref(params) || {})

  return useTrackedQuery({
    queryKey: computed(() => ['autoapi', resourceRef.value, 'get', idRef.value, paramsRef.value]),
    queryFn: async () => {
      const response = await fetcher<GetResponse<T>>(
        path(resourceRef.value, idRef.value),
        { query: paramsRef.value as any },
      )
      return response
    },
    ...options,
    enabled: prerenderSafeEnabled((options as any)?.enabled, () => !!idRef.value),
  } as any) as UseQueryReturnType<GetResponse<T>, Error>
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
  params?: MaybeRef<Omit<ListQueryParams, 'cursor'> | undefined>,
  options?: Omit<UseInfiniteQueryOptions<ListResponse<T>>, 'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'>,
) {
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const paramsRef = computed(() => unref(params) || {})

  return useTrackedInfiniteQuery({
    queryKey: computed(() => ['autoapi', resourceRef.value, 'infinite', paramsRef.value]),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = paramsRef.value
      const queryParams: Record<string, any> = { ...params }

      // Serialize filter object as JSON string
      if (params.filter && typeof params.filter === 'object') {
        queryParams.filter = JSON.stringify(params.filter)
      }

      // Cursor mode: the FIRST page must send an empty cursor too — without it the server answers in offset
      // mode, with no nextCursor, and there is never a second page.
      queryParams.cursor = pageParam ?? ''

      const response = await fetcher<ListResponse<T>>(path(resourceRef.value), {
        query: queryParams as any,
      })
      return response
    },
    getNextPageParam: (lastPage: ListResponse<T>) => {
      return lastPage.meta?.nextCursor
    },
    initialPageParam: undefined,
    ...options,
    enabled: prerenderSafeEnabled((options as any)?.enabled),
  } as any) as UseInfiniteQueryReturnType<InfiniteData<ListResponse<T>>, Error>
}
