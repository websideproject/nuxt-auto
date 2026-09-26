import { toValue } from 'vue'
import { hashKey, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { QueryClient, QueryKey } from '@tanstack/vue-query'

const AWAITED = Symbol.for('autoapi:awaited-queries')

/**
 * The queries a page awaited during server rendering (`await suspense()`), by query hash — the only ones whose
 * data the HTML was rendered with, so the only ones the SSR plugin sends to the client.
 *
 * A query the page did not await can still finish on the server during the render, after its component
 * rendered the loading state. Shipping that data made the client hydrate against HTML it did not produce:
 * skeletons mixed into content, buttons stuck disabled. Left out, the client fetches it itself, from the same
 * loading state the server rendered.
 */
export function awaitedQueries(queryClient: QueryClient): Set<string> {
  return ((queryClient as any)[AWAITED] ??= new Set<string>())
}

function track<R extends { suspense: (...args: any[]) => Promise<any> }>(result: R, queryKey: unknown): R {
  if (!import.meta.server) return result
  const awaited = awaitedQueries(useQueryClient())
  const suspense = result.suspense
  result.suspense = (async (...args: any[]) => {
    const settled = await suspense(...args)
    awaited.add(hashKey(toValue(queryKey) as QueryKey))
    return settled
  }) as R['suspense']
  return result
}

/** `useQuery`, with an awaited `suspense()` on the server marking the query for the client (see awaitedQueries). */
export const useTrackedQuery: typeof useQuery = ((options: any, queryClient?: any) =>
  track(useQuery(options, queryClient), options.queryKey)) as any

/** `useInfiniteQuery`, tracked the same way. */
export const useTrackedInfiniteQuery: typeof useInfiniteQuery = ((options: any, queryClient?: any) =>
  track(useInfiniteQuery(options, queryClient), options.queryKey)) as any
