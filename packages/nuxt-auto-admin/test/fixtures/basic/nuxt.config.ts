import ApiModule from '@websideproject/nuxt-auto-api'
import AdminModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui', // a peer of the admin: its pages use Nuxt UI components and useToast
    ApiModule,
    AdminModule,
    './modules/base',
  ],
  autoAdmin: {
    prefix: '/admin',
  },
  autoApi: {
    prefix: '/api',
    database: { client: 'better-sqlite3' },
  },
})
