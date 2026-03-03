import { useQuery } from '@tanstack/vue-query'
import type { UseQueryOptions } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'

export interface AggregateOptions {
  aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max' | string[]
  field?: string
  groupBy?: string | string[]
  having?: Record<string, any>
  filter?: Record<string, any>
}

export interface AggregateResult {
  [key: string]: any
  _count?: number
  _sum?: number
  _avg?: number
  _min?: number
  _max?: number
}

/**
 * Aggregate query with TanStack Query
 *
 * @example
 * // Simple count
 * const { data } = useAutoApiAggregate('posts', {
 *   aggregate: 'count'
 * })
 *
 * @example
 * // Group by with multiple aggregations
 * const { data } = useAutoApiAggregate('posts', {
 *   aggregate: ['count', 'avg'],
 *   field: 'views',
 *   groupBy: 'published'
 * })
 *
 * @example
 * // With filtering and having
 * const { data } = useAutoApiAggregate('posts', {
 *   aggregate: 'sum',
 *   field: 'views',
 *   groupBy: 'authorId',
 *   filter: { published: true },
 *   having: { _sum: { gt: 1000 } }
 * })
 */
export function useAutoApiAggregate<T = AggregateResult>(
  resource: MaybeRef<string>,
  aggregateOptions: MaybeRef<AggregateOptions>,
  queryOptions?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  const resourceRef = computed(() => unref(resource))
  const optionsRef = computed(() => unref(aggregateOptions))

  return useQuery({
    queryKey: computed(() => [
      'autoapi',
      resourceRef.value,
      'aggregate',
      optionsRef.value
    ]),
    queryFn: async () => {
      const params = new URLSearchParams()

      const opts = optionsRef.value

      // Handle aggregate parameter
      if (opts.aggregate) {
        if (Array.isArray(opts.aggregate)) {
          params.append('aggregate', opts.aggregate.join(','))
        } else {
          params.append('aggregate', opts.aggregate)
        }
      }

      // Handle field parameter
      if (opts.field) {
        params.append('field', opts.field)
      }

      // Handle groupBy parameter
      if (opts.groupBy) {
        if (Array.isArray(opts.groupBy)) {
          params.append('groupBy', opts.groupBy.join(','))
        } else {
          params.append('groupBy', opts.groupBy)
        }
      }

      // Handle filter parameter
      if (opts.filter) {
        params.append('filter', JSON.stringify(opts.filter))
      }

      // Handle having parameter
      if (opts.having) {
        params.append('having', JSON.stringify(opts.having))
      }

      const url = `/api/${resourceRef.value}/aggregate?${params.toString()}`

      return await $fetch<T>(url)
    },
    ...queryOptions
  } as any)
}
