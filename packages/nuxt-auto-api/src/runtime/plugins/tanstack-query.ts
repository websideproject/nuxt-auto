import { defineNuxtPlugin, useState } from '#app'
import { VueQueryPlugin, dehydrate, hydrate } from '@tanstack/vue-query'
import type { DehydratedState } from '@tanstack/vue-query'
import { createAutoApiQueryClient } from '../composables/queryClient'

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = createAutoApiQueryClient()

  nuxtApp.vueApp.use(VueQueryPlugin, {
    queryClient,
  })

  // SSR: queries a page awaited on the server (`await suspense()`) are sent to the client in the payload and
  // hydrated, so the client renders the same data instead of refetching (and mismatching) it.
  const state = useState<DehydratedState | null>('autoapi-vue-query', () => null)
  if (import.meta.server) {
    nuxtApp.hooks.hook('app:rendered', () => {
      state.value = dehydrate(queryClient)
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
