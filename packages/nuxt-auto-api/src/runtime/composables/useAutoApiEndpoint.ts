import { computed, unref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { UseMutationOptions, UseQueryOptions, QueryKey } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { AutoApiToastOptions } from '../types/toast'
import { useAutoApiToast } from './useAutoApiToast'

/**
 * TanStack mutation for a custom endpoint URL.
 * Mirrors useAutoApiCreate/Update but works with any path and method.
 *
 * @example
 * const { mutate, isPending } = useAutoApiEndpointMutation('/api/billing/seats/assign', {
 *   invalidates: [['autoapi', 'billingSeats']],
 *   toast: { enabled: true, showSuccess: true },
 * })
 * mutate({ orgId: '...', email: '...' })
 */
export function useAutoApiEndpointMutation<TData = any, TBody = Record<string, any>>(
  url: MaybeRef<string>,
  options?: {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    /** Query keys to invalidate on success. Pass arrays of key arrays. */
    invalidates?: QueryKey[]
    toast?: AutoApiToastOptions
  } & Omit<UseMutationOptions<TData, Error, TBody>, 'mutationFn'>,
) {
  const queryClient = useQueryClient()
  const urlRef = computed(() => unref(url))
  const { handleSuccess, handleError } = useAutoApiToast()

  const { method = 'POST', invalidates, toast: toastOptions, ...mutationOptions } = options ?? {}

  return useMutation<TData, Error, TBody>({
    mutationFn: async (body: TBody) => {
      return await $fetch<TData>(urlRef.value, { method, body: body as any })
    },
    onSuccess: (data, variables, context) => {
      if (invalidates?.length) {
        invalidates.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
      }
      if (toastOptions?.enabled && toastOptions?.showSuccess) {
        handleSuccess('Done', toastOptions.successMessage)
      }
      mutationOptions?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      if (toastOptions?.enabled && toastOptions?.showErrors) {
        handleError(error)
      }
      mutationOptions?.onError?.(error, variables, context)
    },
    ...mutationOptions,
  })
}

/**
 * TanStack query for a custom endpoint URL.
 * Mirrors useAutoApiGet but works with any path and query params.
 *
 * @example
 * const { data, isPending } = useAutoApiEndpointQuery(
 *   '/api/billing/seats/check',
 *   computed(() => ({ orgId: props.orgId })),
 *   { queryKey: computed(() => ['billing', 'seats-check', props.orgId]) },
 * )
 */
export function useAutoApiEndpointQuery<TData = any>(
  url: MaybeRef<string>,
  params?: MaybeRef<Record<string, any> | undefined>,
  options?: {
    queryKey: MaybeRef<QueryKey>
    toast?: AutoApiToastOptions
  } & Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>,
) {
  const urlRef = computed(() => unref(url))
  const paramsRef = computed(() => unref(params))
  const queryKeyRef = computed(() => unref(options?.queryKey ?? [urlRef.value, paramsRef.value]))

  const { queryKey: _, toast: toastOptions, ...queryOptions } = options ?? {}

  return useQuery<TData, Error>({
    queryKey: queryKeyRef,
    queryFn: async () => {
      const query = paramsRef.value
        ? '?' + new URLSearchParams(
            Object.entries(paramsRef.value)
              .filter(([, v]) => v != null)
              .map(([k, v]) => [k, String(v)]),
          ).toString()
        : ''
      return await $fetch<TData>(`${urlRef.value}${query}`)
    },
    ...queryOptions,
  } as any)
}
