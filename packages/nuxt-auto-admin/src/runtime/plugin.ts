import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((_nuxtApp) => {
  // Plugin initialization
  // Can be used for global setup, registering directives, etc.

  if (import.meta.client) {
    console.log('[nuxt-auto-admin] Admin panel initialized')
  }
})
