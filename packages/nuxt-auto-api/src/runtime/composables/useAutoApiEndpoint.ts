import { computed, unref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { UseMutationOptions, UseQueryOptions, QueryKey } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { AutoApiToastOptions } from '../types/toast'
import { useAutoApiToast } from './useAutoApiToast'
import { prerenderSafeEnabled } from './prerenderEnabled'

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
 * Endpoints built with `createEndpoint` and `responseFormat: 'auto'` wrap the payload in
 * `{ data: … }`. Pass `unwrap: true` to return the inner `data` directly, typed as `TData`,
 * so callers don't hand-unwrap (and can't crash on the envelope shape). Default stays the raw
 * response for back-compat with existing consumers.
 *
 * @example
 * const { data, isPending } = useAutoApiEndpointQuery<EntitlementsMe>(
 *   '/api/entitlements/me',
 *   undefined,
 *   { queryKey: ['entitlements', 'me'], unwrap: true },
 * )
 */
export function useAutoApiEndpointQuery<TData = any>(
  url: MaybeRef<string>,
  params?: MaybeRef<Record<string, any> | undefined>,
  options?: {
    queryKey: MaybeRef<QueryKey>
    toast?: AutoApiToastOptions
    /** Strip the auto-api `{ data }` envelope and return the inner payload typed as `TData`. */
    unwrap?: boolean
  } & Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>,
) {
  const urlRef = computed(() => unref(url))
  const paramsRef = computed(() => unref(params))
  const queryKeyRef = computed(() => unref(options?.queryKey ?? [urlRef.value, paramsRef.value]))

  const { queryKey: _, toast: toastOptions, unwrap, ...queryOptions } = options ?? {}

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
      const res = await $fetch<any>(`${urlRef.value}${query}`)
      // Unwrap auto-api's own `{ data }` envelope when asked (and only when present).
      if (unwrap && res && typeof res === 'object' && 'data' in res) return res.data as TData
      return res as TData
    },
    ...queryOptions,
    enabled: prerenderSafeEnabled((queryOptions as any)?.enabled),
  } as any)
}
