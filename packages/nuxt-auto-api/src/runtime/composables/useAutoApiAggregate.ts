import { computed, unref } from 'vue'
import { useTrackedQuery } from './ssrQuery'
import type { UseQueryOptions, UseQueryReturnType } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { prerenderSafeEnabled } from './prerenderEnabled'
import { useAutoApiPath } from './autoApiPath'
import { useAutoApiFetch } from './autoApiFetch'

export interface AggregateOptions {
  /** `count`, `sum(total)`, … or a list of them. */
  aggregate: string | string[]
  groupBy?: string | string[]
  /** Conditions on aggregate results by name, e.g. `{ count: { $gt: 5 } }`. */
  having?: Record<string, any>
  filter?: Record<string, any>
}

/** `GET /api/{resource}/aggregate` response: one row per group (`group` holds the group-by values). */
export interface AggregateResponse<Row = Record<string, any>> {
  data: Array<Row & { group?: Record<string, any> }>
  meta: { total: number }
}

export function useAutoApiAggregate<T = AggregateResponse>(
  resource: MaybeRef<string>,
  aggregateOptions: MaybeRef<AggregateOptions>,
  queryOptions?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>,
) {
  const path = useAutoApiPath()
  const fetcher = useAutoApiFetch()
  const resourceRef = computed(() => unref(resource))
  const optionsRef = computed(() => unref(aggregateOptions))

  return useTrackedQuery({
    queryKey: computed(() => [
      'autoapi',
      resourceRef.value,
      'aggregate',
      optionsRef.value,
    ]),
    queryFn: async () => {
      const params = new URLSearchParams()

      const opts = optionsRef.value

      // Handle aggregate parameter
      if (opts.aggregate) {
        if (Array.isArray(opts.aggregate)) {
          params.append('aggregate', opts.aggregate.join(','))
        }
        else {
          params.append('aggregate', opts.aggregate)
        }
      }

      // Handle groupBy parameter
      if (opts.groupBy) {
        if (Array.isArray(opts.groupBy)) {
          params.append('groupBy', opts.groupBy.join(','))
        }
        else {
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

      const url = `${path(resourceRef.value, 'aggregate')}?${params.toString()}`

      return await fetcher<T>(url)
    },
    ...queryOptions,
    enabled: prerenderSafeEnabled((queryOptions as any)?.enabled),
  } as any) as UseQueryReturnType<T, Error>
}
