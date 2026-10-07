import { computed, unref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useTrackedQuery } from './ssrQuery'
import type { QueryKey, QueryObserverOptions } from '@tanstack/vue-query'
import { withAutoApiHandlers } from './mutationHandlers'
import type { AutoApiMutationOptions } from './mutationHandlers'
import type { MaybeRef } from 'vue'
import type { AutoApiToastOptions } from '../types/toast'
import { useAutoApiToast } from './useAutoApiToast'
import { prerenderSafeEnabled } from './prerenderEnabled'
import { useAutoApiFetch } from './autoApiFetch'

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
 *
 * For a per-row URL, pass a function of the mutation input — it is called on every `mutate`:
 * const send = useAutoApiEndpointMutation((v: { id: string }) => `/api/campaigns/${v.id}/send`)
 * send.mutate({ id: row.id })
 * (the input is also sent as the body; endpoints ignore keys their `body` schema doesn't declare)
 */
export function useAutoApiEndpointMutation<TData = any, TBody = Record<string, any>>(
  url: MaybeRef<string> | ((input: TBody) => string),
  options?: {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    /** Query keys to invalidate on success. Pass arrays of key arrays. */
    invalidates?: QueryKey[]
    toast?: AutoApiToastOptions
  } & AutoApiMutationOptions<TData, TBody>,
) {
  const queryClient = useQueryClient()
  const fetcher = useAutoApiFetch()
  const resolveUrl = (input: TBody) => (typeof url === 'function' ? url(input) : unref(url))
  const { handleSuccess, handleError } = useAutoApiToast()

  const { method = 'POST', invalidates, toast: toastOptions, ...mutationOptions } = options ?? {}

  return useMutation<TData, Error, TBody>({
    ...withAutoApiHandlers(mutationOptions, {
      onSuccess: async () => {
        if (toastOptions?.enabled && toastOptions?.showSuccess) handleSuccess('Done', toastOptions.successMessage)
        for (const key of invalidates ?? []) await queryClient.invalidateQueries({ queryKey: key })
      },
      onError: (error: Error) => {
        if (toastOptions?.enabled && toastOptions?.showErrors) handleError(error)
      },
    }),
    mutationFn: (body: TBody) => fetcher<TData>(resolveUrl(body), { method, body: body as any }) as Promise<TData>,
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
    /** Run the query only while true (e.g. until the URL is known). */
    enabled?: MaybeRef<boolean> | (() => boolean)
    // The other TanStack options. Typed from `QueryObserverOptions` (a plain object) — `Omit<UseQueryOptions>`
    // over vue-query's `MaybeRef<…>` union kept no keys at all, so `enabled`, `staleTime`, `refetchInterval`, …
    // were all type errors although they always worked at runtime.
  } & Partial<Omit<QueryObserverOptions<TData, Error>, 'queryKey' | 'queryFn' | 'enabled'>>,
) {
  const fetcher = useAutoApiFetch()
  const urlRef = computed(() => unref(url))
  const paramsRef = computed(() => unref(params))
  const queryKeyRef = computed(() => unref(options?.queryKey ?? [urlRef.value, paramsRef.value]))

  const { queryKey: _, toast: toastOptions, unwrap, ...queryOptions } = options ?? {}

  return useTrackedQuery<TData, Error>({
    queryKey: queryKeyRef,
    queryFn: async () => {
      const query = paramsRef.value
        ? '?' + new URLSearchParams(
          Object.entries(paramsRef.value)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
        : ''
      const res = await fetcher<any>(`${urlRef.value}${query}`)
      // Unwrap auto-api's own `{ data }` envelope when asked (and only when present).
      if (unwrap && res && typeof res === 'object' && 'data' in res) return res.data as TData
      return res as TData
    },
    ...queryOptions,
    enabled: prerenderSafeEnabled((queryOptions as any)?.enabled),
  } as any)
}
