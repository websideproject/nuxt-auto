import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { M2MBatchSyncRequest, M2MBatchSyncResponse } from '../types'
import { autoApiKeys } from './queryKeys'

/**
 * Batch sync multiple M2M relations in a single transaction
 *
 * @example
 * const { mutate, isPending } = useM2MBatchSync('articles', articleId, {
 *   onSuccess: () => toast.success('Relations updated')
 * })
 *
 * // Sync multiple relations atomically
 * mutate({
 *   relations: {
 *     categories: { ids: [1, 2] },
 *     tags: { ids: [5, 6, 7] }
 *   }
 * })
 */
export function useM2MBatchSync(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  options?: Omit<UseMutationOptions<M2MBatchSyncResponse, Error, M2MBatchSyncRequest>, 'mutationFn'>
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const idRef = computed(() => unref(id))

  return useMutation({
    mutationFn: async (data: M2MBatchSyncRequest) => {
      const response = await $fetch<M2MBatchSyncResponse>(
        `/api/${resourceRef.value}/${idRef.value}/relations/batch`,
        {
          method: 'POST',
          body: data,
        }
      )
      return response
    },

    // Optimistic update for all relations
    onMutate: async (variables) => {
      const snapshots: Record<string, any> = {}

      // Update each relation optimistically
      for (const [relationName, relationData] of Object.entries(variables.relations)) {
        const queryKey = autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationName)

        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey })

        // Snapshot previous value
        snapshots[relationName] = queryClient.getQueryData(queryKey)

        // Optimistically update
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old

          return {
            ...old,
            ids: relationData.ids,
            total: relationData.ids.length,
          }
        })
      }

      // Return context for rollback
      return { snapshots }
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.snapshots) {
        // Rollback all relations
        for (const [relationName, previousData] of Object.entries(context.snapshots)) {
          const queryKey = autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationName)
          queryClient.setQueryData(queryKey, previousData)
        }
      }

      options?.onError?.(err, variables, context)
    },

    // Invalidate all affected queries on success
    onSuccess: async (data, variables, context) => {
      // Invalidate each relation query
      for (const relationName of Object.keys(variables.relations)) {
        await queryClient.invalidateQueries({
          queryKey: autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationName),
        })

        // Invalidate the related resource queries
        await queryClient.invalidateQueries({
          queryKey: autoApiKeys.resource(relationName),
        })
      }

      // Invalidate the main resource query
      await queryClient.invalidateQueries({
        queryKey: autoApiKeys.get(resourceRef.value, idRef.value),
      })

      options?.onSuccess?.(data, variables, context)
    },

    ...options,
  })
}
