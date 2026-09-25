import { computed, unref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { BulkOperationResponse } from '../types'
import { useAutoApiToast } from './useAutoApiToast'
import { useAutoApiPath } from './autoApiPath'
import { useAutoApiFetch } from './autoApiFetch'
import { withAutoApiHandlers } from './mutationHandlers'
import type { AutoApiMutationOptions } from './mutationHandlers'
import { invalidateAutoApiResource } from './useAutoApiMutation'

function bulkMutation<TVars, TBody>(
  resource: MaybeRef<string>,
  method: 'POST' | 'PATCH' | 'DELETE',
  toBody: (vars: TVars) => TBody,
  verb: string,
  count: (vars: TVars) => number,
  options?: AutoApiMutationOptions<BulkOperationResponse, TVars>,
) {
  const queryClient = useQueryClient()
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()
  const toast = options?.toast ?? {}

  return useMutation<BulkOperationResponse, Error, TVars>({
    ...withAutoApiHandlers(options, {
      onSuccess: (_data: BulkOperationResponse, vars: TVars) => {
        if (toast.enabled && toast.showSuccess) handleSuccess(`Bulk ${verb} successful`, `${count(vars)} ${resourceRef.value} ${verb}`)
        return invalidateAutoApiResource(queryClient, resourceRef.value)
      },
      onError: (error: Error) => {
        if (toast.enabled && toast.showErrors) handleError(error)
      },
    }),
    mutationFn: vars => fetcher<BulkOperationResponse>(path(resourceRef.value, 'bulk'), { method, body: toBody(vars) as any }),
  })
}

/**
 * Create several records in one request (`POST /api/{resource}/bulk { items }`).
 *
 * @example
 * const { mutate } = useAutoApiBulkCreate('posts')
 * mutate([{ title: 'A' }, { title: 'B' }])
 */
export function useAutoApiBulkCreate<TBody = any>(
  resource: MaybeRef<string>,
  options?: AutoApiMutationOptions<BulkOperationResponse, TBody[]>,
) {
  return bulkMutation<TBody[], { items: TBody[] }>(resource, 'POST', items => ({ items }), 'created', v => v.length, options)
}

/**
 * Update several records in one request. Pass each record's id with the fields to change.
 *
 * @example
 * const { mutate } = useAutoApiBulkUpdate('posts')
 * mutate([{ id: 1, published: true }, { id: 2, published: true }])
 */
export function useAutoApiBulkUpdate<TBody = any>(
  resource: MaybeRef<string>,
  options?: AutoApiMutationOptions<BulkOperationResponse, Array<TBody & { id: string | number }>>,
) {
  return bulkMutation<Array<TBody & { id: string | number }>, { items: Array<{ id: string | number, data: any }> }>(
    resource,
    'PATCH',
    rows => ({ items: rows.map(({ id, ...data }) => ({ id, data })) }),
    'updated',
    v => v.length,
    options,
  )
}

/**
 * Delete several records by id (`DELETE /api/{resource}/bulk { ids }`).
 *
 * @example
 * const { mutate } = useAutoApiBulkDelete('posts')
 * mutate([1, 2, 3])
 */
export function useAutoApiBulkDelete(
  resource: MaybeRef<string>,
  options?: AutoApiMutationOptions<BulkOperationResponse, Array<string | number>>,
) {
  return bulkMutation<Array<string | number>, { ids: Array<string | number> }>(resource, 'DELETE', ids => ({ ids }), 'deleted', v => v.length, options)
}
