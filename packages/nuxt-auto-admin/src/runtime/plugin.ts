import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  // Plugin initialization
  // Can be used for global setup, registering directives, etc.

  if (process.client) {
    console.log('[nuxt-auto-admin] Admin panel initialized')
  }
})
