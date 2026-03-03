import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { UseMutationOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { GetResponse } from './useAutoApiQuery'
import type { AutoApiToastOptions } from '../types/toast'
import { useAutoApiToast } from './useAutoApiToast'

/**
 * Create a new resource with TanStack Mutation
 *
 * @example
 * const { mutate, isPending, error } = useAutoApiCreate('posts', {
 *   onSuccess: () => {
 *     // Invalidate list cache
 *   },
 *   toast: { enabled: true, showSuccess: true, showErrors: true }
 * })
 *
 * mutate({
 *   title: 'New Post',
 *   content: 'Content'
 * })
 */
export function useAutoApiCreate<T = any, TBody = any>(
  resource: MaybeRef<string>,
  options?: Omit<UseMutationOptions<GetResponse<T>, Error, TBody>, 'mutationFn'> & { toast?: AutoApiToastOptions }
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()

  const toastOptions = options?.toast || {}
  const { toast: _, ...mutationOptions } = options || {}

  return useMutation({
    mutationFn: async (body: TBody) => {
      return await $fetch<GetResponse<T>>(`/api/${resourceRef.value}`, {
        method: 'POST',
        body
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate list queries
      queryClient.invalidateQueries({
        queryKey: ['autoapi', resourceRef.value, 'list']
      })

      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showSuccess) {
        handleSuccess('Created successfully', `${resourceRef.value} has been created`)
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
 * Update an existing resource with TanStack Mutation
 *
 * @example
 * const { mutate, isPending } = useAutoApiUpdate('posts', {
 *   onSuccess: (data) => {
 *     console.log('Updated:', data)
 *   },
 *   toast: { enabled: true, showSuccess: true, showErrors: true }
 * })
 *
 * mutate({ id: 1, title: 'Updated' })
 */
export function useAutoApiUpdate<T = any, TBody = any>(
  resource: MaybeRef<string>,
  options?: Omit<
    UseMutationOptions<GetResponse<T>, Error, TBody & { id: string | number }>,
    'mutationFn'
  > & { toast?: AutoApiToastOptions }
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()

  const toastOptions = options?.toast || {}
  const { toast: _, ...mutationOptions } = options || {}

  return useMutation({
    mutationFn: async (variables: TBody & { id: string | number }) => {
      const { id, ...body } = variables
      return await $fetch<GetResponse<T>>(`/api/${resourceRef.value}/${id}`, {
        method: 'PATCH',
        body
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate specific item cache
      queryClient.invalidateQueries({
        queryKey: ['autoapi', resourceRef.value, 'get', variables.id]
      })

      // Invalidate list cache
      queryClient.invalidateQueries({
        queryKey: ['autoapi', resourceRef.value, 'list']
      })

      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showSuccess) {
        handleSuccess('Updated successfully', `${resourceRef.value} has been updated`)
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
 * Delete a resource with TanStack Mutation
 *
 * @example
 * const { mutate, isPending } = useAutoApiDelete('posts', {
 *   onSuccess: () => {
 *     navigateTo('/posts')
 *   },
 *   toast: { enabled: true, showSuccess: true, showErrors: true }
 * })
 *
 * mutate(postId)
 */
export function useAutoApiDelete(
  resource: MaybeRef<string>,
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string | number>, 'mutationFn'> & { toast?: AutoApiToastOptions }
) {
  const queryClient = useQueryClient()
  const resourceRef = computed(() => unref(resource))
  const { handleSuccess, handleError } = useAutoApiToast()

  const toastOptions = options?.toast || {}
  const { toast: _, ...mutationOptions } = options || {}

  return useMutation({
    mutationFn: async (id: string | number) => {
      return await $fetch<{ success: boolean }>(`/api/${resourceRef.value}/${id}`, {
        method: 'DELETE'
      })
    },
    onSuccess: (data, id, context) => {
      // Remove specific item from cache
      queryClient.removeQueries({
        queryKey: ['autoapi', resourceRef.value, 'get', id]
      })

      // Invalidate list cache
      queryClient.invalidateQueries({
        queryKey: ['autoapi', resourceRef.value, 'list']
      })

      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showSuccess) {
        handleSuccess('Deleted successfully', `${resourceRef.value} has been deleted`)
      }

      // Call user's onSuccess
      mutationOptions?.onSuccess?.(data, id, context)
    },
    onError: (error, id, context) => {
      // Show toast if enabled
      if (toastOptions.enabled && toastOptions.showErrors) {
        handleError(error)
      }

      // Call user's onError
      mutationOptions?.onError?.(error, id, context)
    },
    ...mutationOptions
  } as any)
}

/**
 * Optimistic update helper
 *
 * @example
 * const { mutate } = useAutoApiUpdate('posts', {
 *   onMutate: async (variables) => {
 *     return useAutoApiOptimisticUpdate('posts', variables.id, variables)
 *   },
 *   onError: (err, variables, context) => {
 *     // Rollback on error
 *     queryClient.setQueryData(context.queryKey, context.previousData)
 *   }
 * })
 */
export function useAutoApiOptimisticUpdate<T = any>(
  resource: string,
  id: string | number,
  updates: Partial<T>
) {
  const queryClient = useQueryClient()
  const queryKey = ['autoapi', resource, 'get', id]

  // Cancel outgoing refetches
  queryClient.cancelQueries({ queryKey })

  // Snapshot previous value
  const previousData = queryClient.getQueryData<GetResponse<T>>(queryKey)

  // Optimistically update
  if (previousData) {
    queryClient.setQueryData<GetResponse<T>>(queryKey, {
      data: { ...previousData.data, ...updates }
    })
  }

  return { queryKey, previousData }
}

/**
 * Unified mutation API that dispatches to the appropriate mutation function
 *
 * @example
 * const { mutateAsync: createPost } = useAutoApiMutation('posts', 'create', {
 *   toast: {
 *     success: { title: 'Post created!' },
 *     error: { title: 'Failed to create post' }
 *   }
 * })
 */
export function useAutoApiMutation<T = any, TBody = any>(
  resource: MaybeRef<string>,
  action: 'create' | 'update' | 'delete',
  options?: any
) {
  if (action === 'create') {
    return useAutoApiCreate<T, TBody>(resource, options)
  } else if (action === 'update') {
    return useAutoApiUpdate<T, TBody>(resource, options)
  } else if (action === 'delete') {
    return useAutoApiDelete(resource, options)
  }

  throw new Error(`Invalid action: ${action}. Must be 'create', 'update', or 'delete'`)
}
