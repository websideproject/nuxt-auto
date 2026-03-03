import type { Nuxt } from '@nuxt/schema'
import { createResolver, defineNuxtModule } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

// Blog module using build-time registration via hooks
export default defineNuxtModule({
  meta: {
    name: 'blog-module',
    configKey: 'blog',
  },

  setup(_options, nuxt: Nuxt) {
    const resolver = createResolver(import.meta.url)

    // Register resources at BUILD TIME via hook
    nuxt.hook('autoApi:registerSchema' as any, (registry: any) => {
      // Register articles
      registry.register('articles', {
        schema: createModuleImport(resolver.resolve('./schema'), 'articles'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'articlesAuth'),
      })

      // Register categories
      registry.register('categories', {
        schema: createModuleImport(resolver.resolve('./schema'), 'categories'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'categoriesAuth'),
      })

      // Register tags
      registry.register('tags', {
        schema: createModuleImport(resolver.resolve('./schema'), 'tags'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'tagsAuth'),
      })

      // Register article-categories junction table
      registry.register('articleCategories', {
        schema: createModuleImport(resolver.resolve('./schema'), 'articleCategories'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'articleCategoriesAuth'),
      })

      // Register article-tags junction table
      registry.register('articleTags', {
        schema: createModuleImport(resolver.resolve('./schema'), 'articleTags'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'articleTagsAuth'),
      })

      console.log('[blog-module] Registered 5 resources at build time')
    })
  },
})
