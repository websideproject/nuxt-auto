import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { createModuleImport } from '../../../../../src/utils/moduleImport'

export default defineNuxtModule({
  meta: { name: 'security-base' },
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const schema = resolver.resolve('../../server/database/schema')
    const auth = resolver.resolve('./auth')
    nuxt.hook('autoApi:registerSchema', (registry: any) => {
      registry.register('users', { schema: createModuleImport(schema, 'users'), authorization: createModuleImport(auth, 'usersAuth'), hiddenFields: ['password'] })
      registry.register('posts', { schema: createModuleImport(schema, 'posts'), authorization: createModuleImport(auth, 'postsAuth') })
      registry.register('labels', { schema: createModuleImport(schema, 'labels'), authorization: createModuleImport(auth, 'labelsAuth') })
      registry.register('docs', { schema: createModuleImport(schema, 'docs'), authorization: createModuleImport(auth, 'docsAuth') })
      // No authorization at all → every operation is refused.
      registry.register('notes', { schema: createModuleImport(schema, 'notes') })
    })
  },
})
