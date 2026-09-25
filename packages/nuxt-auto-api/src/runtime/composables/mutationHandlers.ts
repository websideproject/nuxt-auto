import type { MutationObserverOptions } from '@tanstack/vue-query'
import type { AutoApiToastOptions } from '../types/toast'

/**
 * Options accepted by the auto-api mutation composables: TanStack's mutation options (minus
 * `mutationFn`) plus `toast`.
 */
export type AutoApiMutationOptions<TData = unknown, TVariables = unknown, TContext = unknown>
  = Omit<MutationObserverOptions<TData, Error, TVariables, TContext>, 'mutationFn'> & { toast?: AutoApiToastOptions }

type Handler = (...args: any[]) => unknown

/**
 * Merge the composable's own lifecycle handlers with the caller's. The caller's options are spread FIRST
 * and every handler runs ours, then theirs — so passing `onSuccess` no longer silently replaces the cache
 * invalidation (or `onError` the optimistic-update rollback).
 */
export function withAutoApiHandlers<O extends Record<string, any>>(
  options: O | undefined,
  ours: { onMutate?: Handler, onSuccess?: Handler, onError?: Handler },
): Record<string, any> {
  const { toast: _toast, ...theirs } = (options ?? {}) as Record<string, any>
  const merged: Record<string, any> = { ...theirs }

  if (ours.onMutate || theirs.onMutate) {
    merged.onMutate = async (...args: any[]) => {
      const mine = await ours.onMutate?.(...args)
      const yours = await theirs.onMutate?.(...args)
      if (mine === undefined) return yours
      if (yours === undefined) return mine
      return { ...(mine as object), ...(typeof yours === 'object' && yours !== null ? yours : { value: yours }) }
    }
  }
  for (const key of ['onSuccess', 'onError'] as const) {
    if (!ours[key] && !theirs[key]) continue
    merged[key] = async (...args: any[]) => {
      await ours[key]?.(...args)
      return theirs[key]?.(...args)
    }
  }
  return merged
}
