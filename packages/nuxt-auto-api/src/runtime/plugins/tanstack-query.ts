import { VueQueryPlugin } from '@tanstack/vue-query'
import { createAutoApiQueryClient } from '../composables/queryClient'

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = createAutoApiQueryClient()

  nuxtApp.vueApp.use(VueQueryPlugin, {
    queryClient
  })

  return {
    provide: {
      queryClient
    }
  }
})
