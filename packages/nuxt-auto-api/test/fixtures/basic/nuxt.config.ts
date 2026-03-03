import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    MyModule,
    './modules/base',
  ],
  autoApi: {
    prefix: '/api',
    database: { client: 'better-sqlite3' },
  },
})
