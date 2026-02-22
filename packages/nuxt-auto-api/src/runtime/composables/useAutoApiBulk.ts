import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { GetResponse } from './useAutoApiQuery'
import type { AutoApiToastOptions } from '../types/toast'
import { useAutoApiToast } from './useAutoApiToast'

/**
 * Bulk create multiple resources with TanStack Mutation
 *
 * @example
 * const { mutate, isPending } = useAutoApiBulkCreate('posts', {
 *   onSuccess: (data) => {
 *     console.log('Created:', data)
 *   },
 *   toast: { enabled: true, showSuccess: true, showErrors: true }
 * })
 *
 * mutate([
 *   { title: 'Post 1', content: 'Content 1' },
 *   { title: 'Post 2', content: 'Content 2' }
 * ])
 */
export function useAutoApiBulkCreate<T = any, TBody = any>(
  resource: MaybeRef<string>,
  options?: Omit<UseMutationOptions<GetResponse<T[]>, Error, TBody[]>, 'mutationFn'> & { toast?: AutoApiToastOptions }
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()

  const toastOptions = options?.toast || {}
  const { toast: _, ...mutationOptions } = options || {}

  return useMutation({
    mutationFn: async (items: TBody[]) => {
      return await $fetch<GetResponse<T[]>>(`/api/${resourceRef.value}/bulk`, {
        method: 'POST',
        body: items
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate list queries
      queryClient.invalidateQueries({
        queryKey: ['autoapi', resourceRef.value, 'list']
      })

      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showSuccess) {
        handleSuccess(
          'Bulk created successfully',
          `${variables.length} ${resourceRef.value} have been created`
        )
      }

      // Call user's onSuccess
      mutationOptions?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showErrors) {
        handleError(error)
      }

      // Call user's onError
      mutationOptions?.onError?.(error, variables, context)
    },
    ...mutationOptions
  } as any)
}

/**
 * Bulk update multiple resources with TanStack Mutation
 *
 * @example
 * const { mutate, isPending } = useAutoApiBulkUpdate('posts', {
 *   onSuccess: (data) => {
 *     console.log('Updated:', data)
 *   },
 *   toast: { enabled: true, showSuccess: true, showErrors: true }
 * })
 *
 * mutate([
 *   { id: 1, title: 'Updated Post 1' },
 *   { id: 2, title: 'Updated Post 2' }
 * ])
 */
export function useAutoApiBulkUpdate<T = any, TBody = any>(
  resource: MaybeRef<string>,
  options?: Omit<
    UseMutationOptions<GetResponse<T[]>, Error, (TBody & { id: string | number })[]>,
    'mutationFn'
  > & { toast?: AutoApiToastOptions }
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()

  const toastOptions = options?.toast || {}
  const { toast: _, ...mutationOptions } = options || {}

  return useMutation({
    mutationFn: async (items: (TBody & { id: string | number })[]) => {
      return await $fetch<GetResponse<T[]>>(`/api/${resourceRef.value}/bulk`, {
        method: 'PATCH',
        body: items
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate specific item caches
      variables.forEach(item => {
        queryClient.invalidateQueries({
          queryKey: ['autoapi', resourceRef.value, 'get', item.id]
        })
      })

      // Invalidate list cache
      queryClient.invalidateQueries({
        queryKey: ['autoapi', resourceRef.value, 'list']
      })

      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showSuccess) {
        handleSuccess(
          'Bulk updated successfully',
          `${variables.length} ${resourceRef.value} have been updated`
        )
      }

      // Call user's onSuccess
      mutationOptions?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showErrors) {
        handleError(error)
      }

      // Call user's onError
      mutationOptions?.onError?.(error, variables, context)
    },
    ...mutationOptions
  } as any)
}

/**
 * Bulk delete multiple resources with TanStack Mutation
 *
 * @example
 * const { mutate, isPending } = useAutoApiBulkDelete('posts', {
 *   onSuccess: () => {
 *     console.log('Deleted')
 *   },
 *   toast: { enabled: true, showSuccess: true, showErrors: true }
 * })
 *
 * mutate([1, 2, 3])
 */
export function useAutoApiBulkDelete(
  resource: MaybeRef<string>,
  options?: Omit<
    UseMutationOptions<{ success: boolean; deleted: number }, Error, (string | number)[]>,
    'mutationFn'
  > & { toast?: AutoApiToastOptions }
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()

  const toastOptions = options?.toast || {}
  const { toast: _, ...mutationOptions } = options || {}

  return useMutation({
    mutationFn: async (ids: (string | number)[]) => {
      return await $fetch<{ success: boolean; deleted: number }>(`/api/${resourceRef.value}/bulk`, {
        method: 'DELETE',
        body: { ids }
      })
    },
    onSuccess: (data, ids, context) => {
      // Remove specific items from cache
      ids.forEach(id => {
        queryClient.removeQueries({
          queryKey: ['autoapi', resourceRef.value, 'get', id]
        })
      })

      // Invalidate list cache
      queryClient.invalidateQueries({
        queryKey: ['autoapi', resourceRef.value, 'list']
      })

      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showSuccess) {
        handleSuccess(
          'Bulk deleted successfully',
          `${ids.length} ${resourceRef.value} have been deleted`
        )
      }

      // Call user's onSuccess
      mutationOptions?.onSuccess?.(data, ids, context)
    },
    onError: (error, ids, context) => {
      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showErrors) {
        handleError(error)
      }

      // Call user's onError
      mutationOptions?.onError?.(error, ids, context)
    },
    ...mutationOptions
  } as any)
}
