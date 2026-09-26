import { fileURLToPath } from 'node:url'
import MyModule from '../../../src/module'

// AUTO_API_DIST=1 runs this fixture against the BUILT module (dist/) — what users install — instead of src/.
const autoApi = process.env.AUTO_API_DIST ? fileURLToPath(new URL('../../../dist/module.mjs', import.meta.url)) : MyModule

export default defineNuxtConfig({
  modules: [
    autoApi,
    './modules/base',
  ],
  autoApi: {
    prefix: '/api',
    database: { client: 'better-sqlite3' },
  },
})
