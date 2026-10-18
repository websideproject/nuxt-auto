import { createResolver, defineNuxtModule } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

/**
 * Recipes module — the `notes` resource (schema presets, soft delete, private rows). The custom endpoints of the
 * recipes demo live in server/api/recipes.
 */
export default defineNuxtModule({
  meta: {
    name: 'playground-recipes',
    configKey: 'playgroundRecipes'
  },

  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.hook('autoApi:registerSchema' as never, (registry: Record<string, (...args: unknown[]) => void>) => {
      registry.register('notes', {
        schema: createModuleImport(resolver.resolve('./schema'), 'notes'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'notesAuth')
      })
    })
  }
})
