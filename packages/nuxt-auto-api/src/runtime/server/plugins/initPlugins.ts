import { defineNitroPlugin } from 'nitropack/runtime'
import {
  addMiddleware,
  addContextExtender,
  addResourceHook,
  addGlobalHook,
  markInitialized,
} from './pluginRegistry'
import type { PluginRuntimeContext } from '../../types/plugin'

export default defineNitroPlugin(async () => {
  console.log('[nuxt-auto-api:initPlugins] Nitro plugin starting...')

  // Import plugins from virtual module (generated at build time)
  let plugins: any[] = []
  try {
    const mod = await import('#nuxt-auto-api-plugins' as string)
    console.log('[nuxt-auto-api:initPlugins] Virtual module imported, keys:', Object.keys(mod))
    console.log('[nuxt-auto-api:initPlugins] mod.plugins type:', typeof mod.plugins, 'isArray:', Array.isArray(mod.plugins), 'length:', mod.plugins?.length)
    plugins = mod.plugins || []
  } catch (err) {
    console.error('[nuxt-auto-api:initPlugins] Failed to import virtual module #nuxt-auto-api-plugins:', err)
    markInitialized()
    return
  }

  if (plugins.length === 0) {
    console.log('[nuxt-auto-api:initPlugins] No plugins found, marking initialized')
    markInitialized()
    return
  }

  console.log(`[nuxt-auto-api:initPlugins] Found ${plugins.length} plugin(s):`, plugins.map((p: any) => p?.name || '<unnamed>'))

  const logger = {
    info: (...args: any[]) => console.log('[nuxt-auto-api:plugin]', ...args),
    warn: (...args: any[]) => console.warn('[nuxt-auto-api:plugin]', ...args),
    error: (...args: any[]) => console.error('[nuxt-auto-api:plugin]', ...args),
    debug: (...args: any[]) => console.debug('[nuxt-auto-api:plugin]', ...args),
  }

  // Get runtime config
  let runtimeConfig: any = {}
  try {
    const { useRuntimeConfig } = await import('#imports')
    runtimeConfig = useRuntimeConfig()
  } catch {
    // Runtime config might not be available
  }

  for (const plugin of plugins) {
    if (!plugin) {
      console.warn('[nuxt-auto-api:initPlugins] Skipping null/undefined plugin entry')
      continue
    }
    if (!plugin.runtimeSetup) {
      console.log(`[nuxt-auto-api:initPlugins] Plugin "${plugin.name}" has no runtimeSetup, skipping`)
      continue
    }

    console.log(`[nuxt-auto-api:initPlugins] Initializing plugin "${plugin.name}"...`)

    const runtimeContext: PluginRuntimeContext = {
      addMiddleware,
      addHook: addResourceHook,
      addGlobalHook,
      extendContext: addContextExtender,
      runtimeConfig,
      logger: {
        ...logger,
        info: (...args: any[]) => console.log(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
        warn: (...args: any[]) => console.warn(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
        error: (...args: any[]) => console.error(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
        debug: (...args: any[]) => console.debug(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
      },
    }

    try {
      await plugin.runtimeSetup(runtimeContext)
      logger.info(`Plugin "${plugin.name}" initialized successfully`)
    } catch (error) {
      logger.error(`Failed to initialize plugin "${plugin.name}":`, error)
    }
  }

  markInitialized()
  console.log('[nuxt-auto-api:initPlugins] All plugins processed, marked initialized')
})
