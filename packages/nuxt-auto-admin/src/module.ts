import { defineNuxtModule, addPlugin, createResolver } from '@nuxt/kit'

// Module options TypeScript interface definition
export interface ModuleOptions {
  /*
   * Your module options
   */
  foo: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-auto-admin',
    configKey: 'autoAdmin',
    docs: 'https://github.com/websideproject/nuxt-auto',
  },
  // Default configuration options of the Nuxt module
  defaults: {},
  setup(_options, _nuxt) {
    const resolver = createResolver(import.meta.url)

    // Do not add the extension since the `.ts` will be transpiled to `.mjs` after `npm run prepack`
    addPlugin(resolver.resolve('./runtime/plugin'))
  },
})
