import type { Nuxt } from '@nuxt/schema'
import { createResolver, defineNuxtModule } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

// Blog module using build-time registration via hooks
export default defineNuxtModule({
  meta: {
    name: 'blog-module',
    configKey: 'blog'
  },

  setup(_options, nuxt: Nuxt) {
    const resolver = createResolver(import.meta.url)

    // Register resources at BUILD TIME via hook
    nuxt.hook('autoApi:registerSchema' as never, (registry: Record<string, (...args: unknown[]) => void>) => {
      // Register articles
      registry.register('articles', {
        schema: createModuleImport(resolver.resolve('./schema'), 'articles'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'articlesAuth')
      })

      // Register categories
      registry.register('categories', {
        schema: createModuleImport(resolver.resolve('./schema'), 'categories'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'categoriesAuth')
      })

      // Register tags
      registry.register('tags', {
        schema: createModuleImport(resolver.resolve('./schema'), 'tags'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'tagsAuth')
      })

      // The junction tables (articleCategories, articleTags) are not registered: the M2M routes
      // (/api/articles/:id/relations/categories) find them through their foreign keys, in the Drizzle
      // schema the database was created with. Registering them would add CRUD routes for them.

      console.log('[blog-module] Registered 3 resources at build time')
    })
  }
})
