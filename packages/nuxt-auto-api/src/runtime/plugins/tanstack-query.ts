import { defineNuxtPlugin, useState } from '#app'
import { VueQueryPlugin, defaultShouldDehydrateQuery, dehydrate, hydrate } from '@tanstack/vue-query'
import type { DehydratedState } from '@tanstack/vue-query'
import { createAutoApiQueryClient } from '../composables/queryClient'
import { awaitedQueries } from '../composables/ssrQuery'

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = createAutoApiQueryClient()

  nuxtApp.vueApp.use(VueQueryPlugin, {
    queryClient,
  })

  // SSR: queries a page awaited on the server (`await suspense()`) are sent to the client in the payload and
  // hydrated, so the client renders the same data instead of refetching (and mismatching) it. ONLY those: a
  // query nobody awaited may finish during the render after its component showed the loading state, and its
  // data would make the client hydrate against HTML it did not produce (see awaitedQueries).
  const state = useState<DehydratedState | null>('autoapi-vue-query', () => null)
  if (import.meta.server) {
    const awaited = awaitedQueries(queryClient)
    nuxtApp.hooks.hook('app:rendered', () => {
      state.value = dehydrate(queryClient, {
        shouldDehydrateQuery: query => awaited.has(query.queryHash) && defaultShouldDehydrateQuery(query),
      })
    })
  }
  if (import.meta.client && state.value) {
    hydrate(queryClient, state.value)
  }

  return {
    provide: {
      queryClient,
    },
  }
})
