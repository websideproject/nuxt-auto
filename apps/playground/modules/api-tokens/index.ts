import { createResolver, defineNuxtModule } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

/**
 * API Tokens module — registers the apiKeys resource and demonstrates
 * the createApiTokenPlugin for Bearer token authentication.
 */
export default defineNuxtModule({
  meta: {
    name: 'playground-api-tokens',
    configKey: 'playgroundApiTokens',
  },

  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.hook('autoApi:registerSchema' as any, (registry: any) => {
      registry.register('apiKeys', {
        schema: createModuleImport(resolver.resolve('./schema'), 'apiKeys'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'apiKeysAuth'),
      })

      console.log('[playground-api-tokens] Registered apiKeys resource at build time')
    })
  },
})
