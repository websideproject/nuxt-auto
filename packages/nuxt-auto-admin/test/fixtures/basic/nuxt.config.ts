import ApiModule from '@websideproject/nuxt-auto-api'
import { createAuditLogPlugin } from '../../../../nuxt-auto-api/src/runtime/plugins/auditLogPlugin'
import { createExportPlugin } from '../../../../nuxt-auto-api/src/runtime/plugins/exportPlugin'
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
    features: { import: true, auditLog: true },
  },
  autoApi: {
    prefix: '/api',
    database: { client: 'better-sqlite3' },
    // The routes the admin's export and history use when the app registers them.
    plugins: [
      createExportPlugin({ resources: ['posts'] }),
      createAuditLogPlugin({ async: false }),
    ],
  },
})
