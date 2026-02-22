import ApiModule from '@websideproject/nuxt-auto-api'
import AdminModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    ApiModule,
    AdminModule,
    './modules/base',
  ],
  autoApi: {
    prefix: '/api',
    database: { client: 'better-sqlite3' },
  },
  autoAdmin: {
    prefix: '/admin',
  },
})
