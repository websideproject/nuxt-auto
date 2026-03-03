import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

export default defineNuxtModule({
  meta: { name: 'fixture-base' },
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.hook('autoApi:registerSchema', (registry: any) => {
      registry.register('users', {
        schema: createModuleImport(resolver.resolve('../../server/database/schema'), 'users'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'usersAuth'),
      })

      registry.register('posts', {
        schema: createModuleImport(resolver.resolve('../../server/database/schema'), 'posts'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'postsAuth'),
      })
    })
  },
})
