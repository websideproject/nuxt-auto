import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { M2MOperationResponse, M2MSyncRequest } from '../types'
import { autoApiKeys } from './queryKeys'

/**
 * Sync M2M relations (replace all) with optimistic updates
 *
 * Features:
 * - Optimistic UI updates (instant feedback)
 * - Automatic rollback on error
 * - Cache invalidation on success
 *
 * @example
 * const { mutate, isPending } = useM2MSync('articles', articleId, 'categories', {
 *   onSuccess: () => toast.success('Categories updated')
 * })
 *
 * // Sync categories
 * mutate({ ids: [1, 2, 3] })
 */
export function useM2MSync(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  relation: MaybeRef<string>,
  options?: Omit<UseMutationOptions<M2MOperationResponse, Error, M2MSyncRequest>, 'mutationFn'>
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const idRef = computed(() => unref(id))
  const relationRef = computed(() => unref(relation))

  return useMutation({
    mutationFn: async (data: M2MSyncRequest) => {
      const response = await $fetch<M2MOperationResponse>(
        `/api/${resourceRef.value}/${idRef.value}/relations/${relationRef.value}`,
        {
          method: 'POST',
          body: data,
        }
      )
      return response
    },

    // Optimistic update
    onMutate: async (variables) => {
      const queryKey = autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationRef.value)

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey)

      // Optimistically update
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old

        return {
          ...old,
          ids: variables.ids,
          total: variables.ids.length,
        }
      })

      // Return context for rollback
      return { previousData }
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousData) {
        const queryKey = autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationRef.value)
        queryClient.setQueryData(queryKey, context.previousData)
      }

      // Call user's onError if provided
      options?.onError?.(err, variables, context)
    },

    // Invalidate and refetch on success
    onSuccess: async (data, variables, context) => {
      // Invalidate this specific relation query
      await queryClient.invalidateQueries({
        queryKey: autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationRef.value),
      })

      // Also invalidate the main resource query (it might have relation counts)
      await queryClient.invalidateQueries({
        queryKey: autoApiKeys.get(resourceRef.value, idRef.value),
      })

      // Invalidate the related resource queries (they might have back-references)
      await queryClient.invalidateQueries({
        queryKey: autoApiKeys.resource(relationRef.value),
      })

      // Call user's onSuccess if provided
      options?.onSuccess?.(data, variables, context)
    },

    ...options,
  })
}
