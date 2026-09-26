import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import MyModule from '../../../src/module'
import { createExportPlugin } from '../../../src/runtime/plugins/exportPlugin'
import { createFileUploadPlugin } from '../../../src/runtime/plugins/fileUploadPlugin'
import { createRateLimitPlugin } from '../../../src/runtime/plugins/rateLimitPlugin'

// AUTO_API_DIST=1 runs this fixture against the BUILT module (dist/) — what users install — instead of src/.
const autoApi = process.env.AUTO_API_DIST ? fileURLToPath(new URL('../../../dist/module.mjs', import.meta.url)) : MyModule

export default defineNuxtConfig({
  modules: [autoApi, './modules/base'],
  autoApi: {
    prefix: '/api',
    database: { client: 'better-sqlite3' },
    multiTenancy: { enabled: true, tenantIdField: 'organizationId', excludedResources: ['users'] },
    // Plugins that add routes — those routes must be as protected as the generated ones.
    plugins: [
      // Listed inline with a function option: recreated on the server from its options. Applies only to requests
      // that carry the test header, so it limits nothing else here.
      createRateLimitPlugin({ max: 2, windowMs: 60_000, skip: ctx => !ctx.event.node?.req?.headers?.['x-rate-test'] }),
      createExportPlugin({ formats: ['json', 'csv'] }),
      createFileUploadPlugin({ storage: 'local', localDir: join(tmpdir(), 'autoapi-security-uploads'), resources: { posts: { field: 'cover', accept: ['image/*'] } } }),
    ],
  },
})
