import { computed, unref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { QueryKey } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { useAutoApiPath } from './autoApiPath'
import { useAutoApiFetch } from './autoApiFetch'
import { withAutoApiHandlers } from './mutationHandlers'
import type { AutoApiMutationOptions } from './mutationHandlers'
import { invalidateAutoApiResource } from './useAutoApiMutation'

/**
 * Shared machinery of the M2M mutations: optimistic update of every cached relation list the mutation
 * affects (matched by key prefix, whatever params they were fetched with), rollback on error, and
 * invalidation of both resources on success.
 */
export function useAutoApiM2MMutation<TData, TVars>(opts: {
  resource: MaybeRef<string>
  id: MaybeRef<string | number>
  segments: (vars: TVars) => Array<string | number>
  method: 'POST' | 'DELETE'
  /** Relations this mutation touches, with the optimistic transform of their cached `{ ids }`. */
  affects: (vars: TVars) => Array<{ relation: string, update: (ids: Array<string | number>) => Array<string | number> }>
  options?: AutoApiMutationOptions<TData, TVars>
}) {
  const queryClient = useQueryClient()
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(opts.resource))
  const idRef = computed(() => unref(opts.id))
  const relationKey = (relation: string): QueryKey => ['autoapi', resourceRef.value, idRef.value, 'm2m', relation]

  return useMutation<TData, Error, TVars>({
    ...withAutoApiHandlers(opts.options, {
      onMutate: async (vars: TVars) => {
        const snapshots: Array<[QueryKey, unknown]> = []
        for (const { relation, update } of opts.affects(vars)) {
          const queryKey = relationKey(relation)
          await queryClient.cancelQueries({ queryKey })
          snapshots.push(...queryClient.getQueriesData({ queryKey }))
          queryClient.setQueriesData({ queryKey }, (old: any) => {
            if (!old?.ids) return old
            const ids = update(old.ids)
            return { ...old, ids, total: ids.length }
          })
        }
        return { snapshots }
      },
      onError: (_error: Error, _vars: TVars, context: any) => {
        for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data)
      },
      onSuccess: async (_data: TData, vars: TVars) => {
        await invalidateAutoApiResource(queryClient, resourceRef.value)
        for (const { relation } of opts.affects(vars)) await invalidateAutoApiResource(queryClient, relation)
      },
    }),
    mutationFn: vars => fetcher<TData>(path(resourceRef.value, idRef.value, 'relations', ...opts.segments(vars)), {
      method: opts.method,
      body: vars as any,
    }) as Promise<TData>,
  })
}
