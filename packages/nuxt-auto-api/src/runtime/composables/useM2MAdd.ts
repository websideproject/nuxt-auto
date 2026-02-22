import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { M2MOperationResponse, M2MAddRequest } from '../types'
import { autoApiKeys } from './queryKeys'

/**
 * Add M2M relations (append) with optimistic updates
 *
 * @example
 * const { mutate, isPending } = useM2MAdd('articles', articleId, 'tags', {
 *   onSuccess: () => toast.success('Tags added')
 * })
 *
 * // Add tags
 * mutate({ ids: [4, 5, 6] })
 */
export function useM2MAdd(
  resource: MaybeRef<string>,
  id: MaybeRef<string | number>,
  relation: MaybeRef<string>,
  options?: Omit<UseMutationOptions<M2MOperationResponse, Error, M2MAddRequest>, 'mutationFn'>
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const idRef = computed(() => unref(id))
  const relationRef = computed(() => unref(relation))

  return useMutation({
    mutationFn: async (data: M2MAddRequest) => {
      const response = await $fetch<M2MOperationResponse>(
        `/api/${resourceRef.value}/${idRef.value}/relations/${relationRef.value}/add`,
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

        const currentIds = old.ids || []
        const newIds = [...currentIds, ...variables.ids]

        return {
          ...old,
          ids: newIds,
          total: newIds.length,
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

      options?.onError?.(err, variables, context)
    },

    // Invalidate and refetch on success
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: autoApiKeys.m2mRelation(resourceRef.value, idRef.value, relationRef.value),
      })

      await queryClient.invalidateQueries({
        queryKey: autoApiKeys.get(resourceRef.value, idRef.value),
      })

      await queryClient.invalidateQueries({
        queryKey: autoApiKeys.resource(relationRef.value),
      })

      options?.onSuccess?.(data, variables, context)
    },

    ...options,
  })
}
