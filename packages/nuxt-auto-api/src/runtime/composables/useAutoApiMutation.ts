import { computed, unref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { QueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { GetResponse } from './useAutoApiQuery'
import { useAutoApiToast } from './useAutoApiToast'
import { useAutoApiPath } from './autoApiPath'
import { useAutoApiFetch } from './autoApiFetch'
import { withAutoApiHandlers } from './mutationHandlers'
import type { AutoApiMutationOptions } from './mutationHandlers'

/**
 * Invalidate every cached query of a resource (lists, gets, infinite lists, aggregates, M2M). Keys are
 * matched by prefix, so an id cached as `'12'` and one mutated as `12` cannot miss each other.
 */
export function invalidateAutoApiResource(queryClient: QueryClient, resource: string) {
  return queryClient.invalidateQueries({ queryKey: ['autoapi', resource] })
}

/**
 * Create a resource.
 *
 * @example
 * const { mutate, isPending } = useAutoApiCreate('posts', { toast: { enabled: true, showSuccess: true } })
 * mutate({ title: 'New Post' })
 */
export function useAutoApiCreate<T = any, TBody = any>(
  resource: MaybeRef<string>,
  options?: AutoApiMutationOptions<GetResponse<T>, TBody>,
) {
  const queryClient = useQueryClient()
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()
  const toast = options?.toast ?? {}

  return useMutation<GetResponse<T>, Error, TBody>({
    ...withAutoApiHandlers(options, {
      onSuccess: () => {
        if (toast.enabled && toast.showSuccess) handleSuccess('Created successfully', `${resourceRef.value} has been created`)
        return invalidateAutoApiResource(queryClient, resourceRef.value)
      },
      onError: (error: Error) => {
        if (toast.enabled && toast.showErrors) handleError(error)
      },
    }),
    mutationFn: body => fetcher<GetResponse<T>>(path(resourceRef.value), { method: 'POST', body: body as any }),
  })
}

/**
 * Update a resource. Pass the id alongside the fields to change.
 *
 * @example
 * const { mutate } = useAutoApiUpdate('posts')
 * mutate({ id: 1, title: 'Updated' })
 */
export function useAutoApiUpdate<T = any, TBody = any>(
  resource: MaybeRef<string>,
  options?: AutoApiMutationOptions<GetResponse<T>, TBody & { id: string | number }>,
) {
  const queryClient = useQueryClient()
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()
  const toast = options?.toast ?? {}

  return useMutation<GetResponse<T>, Error, TBody & { id: string | number }>({
    ...withAutoApiHandlers(options, {
      onSuccess: () => {
        if (toast.enabled && toast.showSuccess) handleSuccess('Updated successfully', `${resourceRef.value} has been updated`)
        return invalidateAutoApiResource(queryClient, resourceRef.value)
      },
      onError: (error: Error) => {
        if (toast.enabled && toast.showErrors) handleError(error)
      },
    }),
    mutationFn: ({ id, ...body }) => fetcher<GetResponse<T>>(path(resourceRef.value, id), { method: 'PATCH', body }),
  })
}

/**
 * Delete a resource by id.
 *
 * @example
 * const { mutate } = useAutoApiDelete('posts', { onSuccess: () => navigateTo('/posts') })
 * mutate(postId)
 */
export function useAutoApiDelete(
  resource: MaybeRef<string>,
  options?: AutoApiMutationOptions<{ success: boolean, softDeleted?: boolean, deletionId?: string }, string | number>,
) {
  const queryClient = useQueryClient()
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()
  const toast = options?.toast ?? {}

  return useMutation<{ success: boolean, softDeleted?: boolean, deletionId?: string }, Error, string | number>({
    ...withAutoApiHandlers(options, {
      onSuccess: () => {
        if (toast.enabled && toast.showSuccess) handleSuccess('Deleted successfully', `${resourceRef.value} has been deleted`)
        return invalidateAutoApiResource(queryClient, resourceRef.value)
      },
      onError: (error: Error) => {
        if (toast.enabled && toast.showErrors) handleError(error)
      },
    }),
    mutationFn: id => fetcher(path(resourceRef.value, id), { method: 'DELETE' }),
  })
}

/**
 * Optimistically patch a cached `get` result. Call it from `onMutate` with the query client of the component
 * (TanStack's `useQueryClient()` only works during setup) and return the result for rollback.
 *
 * @example
 * const queryClient = useQueryClient()
 * const { mutate } = useAutoApiUpdate('posts', {
 *   onMutate: vars => useAutoApiOptimisticUpdate(queryClient, 'posts', vars.id, vars),
 *   onError: (_e, _v, ctx: any) => ctx && queryClient.setQueryData(ctx.queryKey, ctx.previousData),
 * })
 */
export async function useAutoApiOptimisticUpdate<T = any>(
  queryClient: QueryClient,
  resource: string,
  id: string | number,
  updates: Partial<T>,
) {
  const queryKey = ['autoapi', resource, 'get', id]
  await queryClient.cancelQueries({ queryKey })
  const previousData = queryClient.getQueryData<GetResponse<T>>(queryKey)
  if (previousData) queryClient.setQueryData<GetResponse<T>>(queryKey, { data: { ...previousData.data, ...updates } })
  return { queryKey, previousData }
}

/**
 * One entry point for the three mutations.
 *
 * @example
 * const { mutateAsync: createPost } = useAutoApiMutation('posts', 'create')
 */
export function useAutoApiMutation<T = any, TBody = any>(
  resource: MaybeRef<string>,
  action: 'create' | 'update' | 'delete',
  options?: AutoApiMutationOptions<any, any>,
) {
  if (action === 'create') return useAutoApiCreate<T, TBody>(resource, options)
  if (action === 'update') return useAutoApiUpdate<T, TBody>(resource, options)
  if (action === 'delete') return useAutoApiDelete(resource, options)
  throw new Error(`Invalid action: ${action}. Must be 'create', 'update', or 'delete'`)
}
