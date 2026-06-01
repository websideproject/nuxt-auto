import { defineNitroPlugin } from 'nitropack/runtime'
import { useRuntimeConfig } from '#imports'
import {
  addMiddleware,
  addContextExtender,
  addResourceHook,
  addGlobalHook,
  registerPermissionEvaluator,
  markInitialized,
} from './pluginRegistry'
import type { PluginRuntimeContext } from '../../types/plugin'

// Verbose startup tracing is opt-in (set NUXT_AUTO_API_DEBUG=1). By default only genuine
// errors are logged — a build-only plugin (buildSetup, no runtimeSetup) being skipped at runtime
// is normal, not a warning worth printing on every boot.
const DEBUG = !!process.env.NUXT_AUTO_API_DEBUG
const debug = (...args: any[]) => { if (DEBUG) console.log('[nuxt-auto-api:initPlugins]', ...args) }

export default defineNitroPlugin(async () => {
  debug('Nitro plugin starting…')

  // Import plugins from virtual module (generated at build time)
  let plugins: any[] = []
  try {
    const mod = await import('#nuxt-auto-api-plugins' as string)
    debug('Virtual module imported, keys:', Object.keys(mod))
    debug('mod.plugins isArray:', Array.isArray(mod.plugins), 'length:', mod.plugins?.length)
    plugins = mod.plugins || []
  }
  catch (err) {
    console.error('[nuxt-auto-api:initPlugins] Failed to import virtual module #nuxt-auto-api-plugins:', err)
    markInitialized()
    return
  }

  if (plugins.length === 0) {
    debug('No plugins found, marking initialized')
    markInitialized()
    return
  }

  debug(`Found ${plugins.length} plugin(s):`, plugins.map((p: any) => p?.name || '<unnamed>'))

  const runtimeConfig = useRuntimeConfig()

  for (const plugin of plugins) {
    if (!plugin) {
      debug('Skipping null/undefined plugin entry')
      continue
    }
    // Build-only plugins (buildSetup, no runtimeSetup — e.g. platform-export, which registers its
    // endpoint at build time) have nothing to do at runtime. Skip quietly.
    if (!plugin.runtimeSetup) {
      debug(`Plugin "${plugin.name}" has no runtimeSetup, skipping`)
      continue
    }

    debug(`Initializing plugin "${plugin.name}"…`)

    const runtimeContext: PluginRuntimeContext = {
      addMiddleware,
      addHook: addResourceHook,
      addGlobalHook,
      extendContext: addContextExtender,
      registerPermissionEvaluator,
      runtimeConfig,
      logger: {
        info: (...args: any[]) => debug(`[plugin:${plugin.name}]`, ...args),
        warn: (...args: any[]) => console.warn(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
        error: (...args: any[]) => console.error(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
        debug: (...args: any[]) => debug(`[plugin:${plugin.name}]`, ...args),
      },
    }

    try {
      await plugin.runtimeSetup(runtimeContext)
      debug(`Plugin "${plugin.name}" initialized successfully`)
    }
    catch (error) {
      console.error(`[nuxt-auto-api:initPlugins] Failed to initialize plugin "${plugin.name}":`, error)
    }
  }

  markInitialized()
  debug('All plugins processed, marked initialized')
})
