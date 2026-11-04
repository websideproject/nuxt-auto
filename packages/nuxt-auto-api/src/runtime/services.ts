// Services alone, with no server code, so code that runs in the browser as well can import them: a registry that a
// Nuxt plugin and a Nitro plugin both fill, read by shared code. `@websideproject/nuxt-auto-api/plugins` exports the
// same functions, alongside the plugin factories that need Node and h3. In the browser the registry is per page, and
// `getNitroApp()` is `undefined`.
export { provideService, useService, hasService, removeService, getNitroApp } from './server/plugins/pluginRegistry'
export type { AutoApiServices } from './types/plugin'
