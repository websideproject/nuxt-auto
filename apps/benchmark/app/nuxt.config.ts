export default defineNuxtConfig({
  modules: [
    '@websideproject/nuxt-auto-api',
    './modules/base',
  ],

  autoApi: {
    prefix: '/api',
    // REST only: no client composables, no @tanstack/vue-query.
    vueQuery: false,
    database: {
      client: 'better-sqlite3'
    },
    pagination: {
      default: 'offset',
      defaultLimit: 20,
      maxLimit: 100
    }
  },

  compatibilityDate: '2025-01-15',
  
  // Ensure we can import from server/database
  nitro: {
    imports: {
      dirs: ['./server/database']
    }
  }
})
