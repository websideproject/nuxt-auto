import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

/**
 * Base module for playground - registers core resources (users, posts, comments)
 * This demonstrates how a main app can register its resources via hooks
 */
export default defineNuxtModule({
  meta: {
    name: 'playground-base',
    configKey: 'playgroundBase',
  },

  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Register resources at BUILD TIME via hook
    nuxt.hook('autoApi:registerSchema', (registry) => {
      // Register users
      registry.register('users', {
        schema: createModuleImport(resolver.resolve('../../server/database/schema'), 'users'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'usersAuth'),
        validation: createModuleImport(resolver.resolve('../../server/validation/users'), 'usersValidation'),
        hiddenFields: ['password', 'apiKey'], // Hide sensitive fields from all API responses
      })

      // Register posts
      registry.register('posts', {
        schema: createModuleImport(resolver.resolve('../../server/database/schema'), 'posts'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'postsAuth'),
        validation: createModuleImport(resolver.resolve('../../server/validation/posts'), 'postsValidation'),
      })

      // Register comments
      registry.register('comments', {
        schema: createModuleImport(resolver.resolve('../../server/database/schema'), 'comments'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'commentsAuth'),
      })

      console.log('[playground-base] Registered 3 core resources at build time')
    })
  },
})
