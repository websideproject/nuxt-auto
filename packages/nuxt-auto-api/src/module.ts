import { defineNuxtModule, createResolver, addServerHandler, addServerImportsDir, addTemplate, addPlugin, addImportsDir } from '@nuxt/kit'
import type { AutoApiOptions, ResourceRegistration, AutoApiPlugin } from './runtime/types'
import type { PluginBuildContext } from './runtime/types/plugin'

export interface ModuleOptions extends Partial<AutoApiOptions> {}

export interface BuildTimeRegistry {
  resources: Map<string, ResourceRegistration>
  register(name: string, config: Omit<ResourceRegistration, 'name'>): void
  getAll(): ResourceRegistration[]
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-auto-api',
    configKey: 'autoApi',
  },
  defaults: {
    prefix: '/api',
    database: {
      client: 'better-sqlite3',
    },
    pagination: {
      default: 'offset',
      defaultLimit: 20,
      maxLimit: 100,
    },
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Add TanStack Query plugin for frontend
    addPlugin(resolver.resolve('./runtime/plugins/tanstack-query'))

    // Add composables for auto-import
    addImportsDir(resolver.resolve('./runtime/composables'))

    // Add server utilities
    addServerImportsDir(resolver.resolve('./runtime/server/utils'))

    // Alias sub-path exports so they always resolve to source — works in both stub and full-build modes
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.alias = nitroConfig.alias || {}
      nitroConfig.alias['@websideproject/nuxt-auto-api/plugins'] = resolver.resolve('./runtime/plugins/index')
      nitroConfig.alias['@websideproject/nuxt-auto-api/database'] = resolver.resolve('./runtime/server/database/index')
      nitroConfig.alias['@websideproject/nuxt-auto-api/utils'] = resolver.resolve('./runtime/server/utils/index')
    })

    // Add runtime config
    nuxt.options.runtimeConfig.autoApi = options as any

    // Create build-time registry
    const registry: BuildTimeRegistry = {
      resources: new Map(),
      register(name: string, config: Omit<ResourceRegistration, 'name'>) {
        if (this.resources.has(name)) {
          throw new Error(`[nuxt-auto-api] Resource "${name}" is already registered`)
        }
        this.resources.set(name, { name, ...config })
        console.log(`[nuxt-auto-api] Registered resource: ${name}`)
      },
      getAll() {
        return Array.from(this.resources.values())
      }
    }

    // ─── Plugin System ────────────────────────────────────────────────────
    // Plugins can be registered from 3 sources:
    //   1. File path in nuxt.config.ts:  plugins: '~/server/autoapi-plugins'
    //   2. Inline array (legacy/simple): plugins: [simplePlugin]
    //   3. Community Nuxt modules:       hook 'autoApi:registerPlugins'
    // ──────────────────────────────────────────────────────────────────────

    const logger = {
      info: (...args: any[]) => console.log('[nuxt-auto-api]', ...args),
      warn: (...args: any[]) => console.warn('[nuxt-auto-api]', ...args),
      error: (...args: any[]) => console.error('[nuxt-auto-api]', ...args),
      debug: (...args: any[]) => console.debug('[nuxt-auto-api]', ...args),
    }

    // Collect plugin file paths from community modules via hook
    const pluginFilePaths: string[] = []

    // Determine user plugin source
    const userPlugins = options.plugins
    let userPluginFilePath: string | null = null
    let inlinePlugins: AutoApiPlugin[] = []

    if (typeof userPlugins === 'string') {
      // Resolve ~ and ~~ aliases to absolute paths (they don't work inside virtual .mjs files)
      // Both ~ and ~~ resolve to rootDir since server files live at project root, not srcDir (app/)
      let resolved = userPlugins
      if (resolved.startsWith('~~/') || resolved.startsWith('~~\\')) {
        resolved = resolved.replace(/^~~/, nuxt.options.rootDir)
      } else if (resolved.startsWith('~/') || resolved.startsWith('~\\')) {
        resolved = resolved.replace(/^~/, nuxt.options.rootDir)
      }
      userPluginFilePath = resolved
      console.log(`[nuxt-auto-api] Plugin file: ${userPlugins} → ${userPluginFilePath}`)
    } else if (Array.isArray(userPlugins)) {
      // Inline array (legacy/simple plugins)
      inlinePlugins = userPlugins
      console.warn('[nuxt-auto-api] Inline plugins in nuxt.config.ts have limited closure support. Consider using a file path instead: plugins: \'~/server/autoapi-plugins\'')
    }

    // Run build-time setup for inline plugins
    for (const plugin of inlinePlugins) {
      if (!plugin.buildSetup) continue

      const buildContext: PluginBuildContext = {
        addServerHandler,
        addServerImportsDir,
        addImportsDir,
        addServerPlugin: (pluginPath: string) => {
          nuxt.options.nitro = nuxt.options.nitro || {}
          nuxt.options.nitro.plugins = nuxt.options.nitro.plugins || []
          nuxt.options.nitro.plugins.push(pluginPath)
        },
        addPlugin,
        addTemplate,
        options: options as AutoApiOptions,
        nuxt,
        resolver,
        logger: {
          ...logger,
          info: (...args: any[]) => console.log(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
          warn: (...args: any[]) => console.warn(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
          error: (...args: any[]) => console.error(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
          debug: (...args: any[]) => console.debug(`[nuxt-auto-api:plugin:${plugin.name}]`, ...args),
        },
      }

      try {
        await plugin.buildSetup(buildContext)
        console.log(`[nuxt-auto-api] ✓ Plugin "${plugin.name}" build setup complete`)
      } catch (error) {
        console.error(`[nuxt-auto-api] ✗ Plugin "${plugin.name}" build setup failed:`, error)
      }
    }

    // Call hook to let community modules register plugin files
    await nuxt.callHook('autoApi:registerPlugins' as any, {
      addFile(filePath: string) {
        pluginFilePaths.push(filePath)
        console.log(`[nuxt-auto-api] Plugin file registered via hook: ${filePath}`)
      },
    })

    // Determine if we have any plugins
    const hasPlugins = !!userPluginFilePath || pluginFilePaths.length > 0 || inlinePlugins.some(p => p.runtimeSetup)

    // Generate virtual module for plugins
    addTemplate({
      filename: 'nuxt-auto-api-plugins.mjs',
      getContents: () => {
        const content = generatePluginsVirtualModule({
          userFilePath: userPluginFilePath,
          moduleFilePaths: pluginFilePaths,
          inlinePlugins: inlinePlugins.filter(p => p.runtimeSetup),
        })
        console.log('[nuxt-auto-api] Generated plugin virtual module:\n' + content)
        return content
      },
      write: true,
    })

    nuxt.options.alias['#nuxt-auto-api-plugins'] = resolver.resolve(nuxt.options.buildDir, 'nuxt-auto-api-plugins.mjs')

    // Export plugin registry functions for runtime use
    addTemplate({
      filename: 'nuxt-auto-api-plugin-registry.mjs',
      getContents: () => `
export {
  addMiddleware,
  addContextExtender,
  addResourceHook,
  addGlobalHook,
  markInitialized,
  isInitialized,
  getMiddlewareForStage,
  getContextExtenders,
  getPluginHooks,
} from ${JSON.stringify(resolver.resolve('./runtime/server/plugins/pluginRegistry.js'))}
`,
      write: true,
    })

    nuxt.options.alias['#nuxt-auto-api-plugin-registry'] = resolver.resolve(nuxt.options.buildDir, 'nuxt-auto-api-plugin-registry.mjs')

    // Always register the Nitro plugin that initializes runtime plugins
    nuxt.options.nitro = nuxt.options.nitro || {}
    nuxt.options.nitro.plugins = nuxt.options.nitro.plugins || []
    nuxt.options.nitro.plugins.push(resolver.resolve('./runtime/server/plugins/initPlugins'))

    if (hasPlugins) {
      console.log('[nuxt-auto-api] ✓ Plugin system initialized')
    }

    // After all modules loaded, call hook and generate virtual module
    nuxt.hook('modules:done', async () => {
      // Call hook to let other modules register resources
      await nuxt.callHook('autoApi:registerSchema' as any, registry)
      const resources = registry.getAll()

      if (resources.length === 0) {
        console.warn('[nuxt-auto-api] No resources registered')
        return
      }

      console.log(`[nuxt-auto-api] Registering ${resources.length} resources`)

      // Generate virtual module with all resource imports
      const virtualModuleContent = generateVirtualModule(resources)

      // Generate virtual module
      addTemplate({
        filename: 'nuxt-auto-api-registry.mjs',
        getContents: () => virtualModuleContent,
        write: true,
      })

      // Add type declarations for the virtual module
      addTemplate({
        filename: 'nuxt-auto-api-registry.d.ts',
        getContents: () => generateVirtualModuleTypes(resources),
        write: true,
      })

      // Register virtual import alias for Nitro
      nuxt.options.alias['#nuxt-auto-api-registry'] = resolver.resolve(nuxt.options.buildDir, 'nuxt-auto-api-registry.mjs')

      // Register handlers for each resource
      const prefix = options.prefix || '/api'

      for (const resource of resources) {
        // Note: File-based routes in server/api/ take precedence over these
        // Users can override any endpoint by creating server/api/{resource}/...

        // List endpoint - GET /api/{resource}
        addServerHandler({
          route: `${prefix}/${resource.name}`,
          method: 'get',
          handler: resolver.resolve('./runtime/server/handlers/list.entry'),
        })

        // Get single endpoint - GET /api/{resource}/:id
        addServerHandler({
          route: `${prefix}/${resource.name}/:id`,
          method: 'get',
          handler: resolver.resolve('./runtime/server/handlers/get.entry'),
        })

        // Create endpoint - POST /api/{resource}
        addServerHandler({
          route: `${prefix}/${resource.name}`,
          method: 'post',
          handler: resolver.resolve('./runtime/server/handlers/create.entry'),
        })

        // Update endpoint - PATCH /api/{resource}/:id
        addServerHandler({
          route: `${prefix}/${resource.name}/:id`,
          method: 'patch',
          handler: resolver.resolve('./runtime/server/handlers/update.entry'),
        })

        // Delete endpoint - DELETE /api/{resource}/:id
        addServerHandler({
          route: `${prefix}/${resource.name}/:id`,
          method: 'delete',
          handler: resolver.resolve('./runtime/server/handlers/delete.entry'),
        })

        // Restore endpoint - POST /api/{resource}/:id/restore
        // Only registered for resources with soft delete support
        addServerHandler({
          route: `${prefix}/${resource.name}/:id/restore`,
          method: 'post',
          handler: resolver.resolve('./runtime/server/handlers/restore.entry'),
        })

        // Permissions endpoint - GET /api/{resource}/permissions
        addServerHandler({
          route: `${prefix}/${resource.name}/permissions`,
          method: 'get',
          handler: resolver.resolve('./runtime/server/handlers/permissions.entry'),
        })

        // Bulk operations endpoint - POST/PATCH/DELETE /api/{resource}/bulk
        addServerHandler({
          route: `${prefix}/${resource.name}/bulk`,
          handler: resolver.resolve('./runtime/server/handlers/bulk.entry'),
        })

        // Aggregation endpoint - GET /api/{resource}/aggregate
        addServerHandler({
          route: `${prefix}/${resource.name}/aggregate`,
          method: 'get',
          handler: resolver.resolve('./runtime/server/handlers/aggregate.entry'),
        })

        // M2M endpoints
        // List M2M relations - GET /api/{resource}/:id/relations/:relation
        addServerHandler({
          route: `${prefix}/${resource.name}/:id/relations/:relation`,
          method: 'get',
          handler: resolver.resolve('./runtime/server/handlers/m2m/list.entry'),
        })

        // Sync M2M relations - POST /api/{resource}/:id/relations/:relation
        addServerHandler({
          route: `${prefix}/${resource.name}/:id/relations/:relation`,
          method: 'post',
          handler: resolver.resolve('./runtime/server/handlers/m2m/sync.entry'),
        })

        // Add M2M relations - POST /api/{resource}/:id/relations/:relation/add
        addServerHandler({
          route: `${prefix}/${resource.name}/:id/relations/:relation/add`,
          method: 'post',
          handler: resolver.resolve('./runtime/server/handlers/m2m/add.entry'),
        })

        // Remove M2M relations - DELETE /api/{resource}/:id/relations/:relation/remove
        addServerHandler({
          route: `${prefix}/${resource.name}/:id/relations/:relation/remove`,
          method: 'delete',
          handler: resolver.resolve('./runtime/server/handlers/m2m/remove.entry'),
        })

        // Batch sync multiple M2M relations - POST /api/{resource}/:id/relations/batch
        addServerHandler({
          route: `${prefix}/${resource.name}/:id/relations/batch`,
          method: 'post',
          handler: resolver.resolve('./runtime/server/handlers/m2m/batch.entry'),
        })

        console.log(`[nuxt-auto-api] ✓ Registered routes for /${resource.name}`)
      }

      // Global permissions endpoint - GET /api/permissions
      // Returns permissions for all resources in a single request
      addServerHandler({
        route: `${prefix}/permissions`,
        method: 'get',
        handler: resolver.resolve('./runtime/server/handlers/allPermissions.entry'),
      })

      console.log('[nuxt-auto-api] ✓ Registered global permissions endpoint')

      // M2M Detection endpoints (for admin module auto-configuration)
      // Detect M2M relationships for a resource
      addServerHandler({
        route: `${prefix}/_m2m/detect/:resource`,
        method: 'get',
        handler: resolver.resolve('./runtime/server/handlers/m2m/detect-relationships'),
      })

      // Check if a table is a junction table
      addServerHandler({
        route: `${prefix}/_m2m/is-junction/:table`,
        method: 'get',
        handler: resolver.resolve('./runtime/server/handlers/m2m/is-junction'),
      })

      // Get all junction table names
      addServerHandler({
        route: `${prefix}/_m2m/junctions`,
        method: 'get',
        handler: resolver.resolve('./runtime/server/handlers/m2m/list-junctions'),
      })

      // Debug detection endpoint
      addServerHandler({
        route: `${prefix}/_m2m/debug-detection`,
        method: 'get',
        handler: resolver.resolve('./runtime/server/handlers/m2m/debug-detection'),
      })

      console.log('[nuxt-auto-api] ✓ Registered M2M detection endpoints')
      console.log('[nuxt-auto-api] All routes registered successfully')
    }) // end modules:done hook
  },
})

/**
 * Ensure module path has .ts or .js extension for ESM imports
 */
function ensureExtension(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.js') || path.endsWith('.mjs')) {
    return path
  }
  // Try .ts first (TypeScript source)
  return `${path}.ts`
}

/**
 * Generate virtual module content that exports the resource registry
 */
function generateVirtualModule(resources: ResourceRegistration[]): string {
  const imports: string[] = []
  const registryEntries: string[] = []

  resources.forEach((resource, index) => {
    const varName = `resource${index}`

    // Import schema
    const schemaImport = resource.schema as any
    if (schemaImport.__modulePath) {
      const exportName = schemaImport.__exportName || resource.name
      const modulePath = ensureExtension(schemaImport.__modulePath)
      imports.push(`import { ${exportName} as ${varName}Schema } from '${modulePath}'`)
    } else {
      throw new Error(`[nuxt-auto-api] Resource "${resource.name}" schema must use createModuleImport()`)
    }

    // Import authorization if provided
    let authVar = 'undefined'
    if (resource.authorization) {
      const authImport = resource.authorization as any
      if (authImport.__modulePath) {
        const exportName = authImport.__exportName || resource.name + 'Auth'
        authVar = `${varName}Auth`
        const modulePath = ensureExtension(authImport.__modulePath)
        imports.push(`import { ${exportName} as ${authVar} } from '${modulePath}'`)
      }
    }

    // Import validation if provided
    let validationVar = 'undefined'
    if (resource.validation) {
      const validationImport = resource.validation as any
      if (validationImport.__modulePath) {
        const exportName = validationImport.__exportName || resource.name + 'Validation'
        validationVar = `${varName}Validation`
        const modulePath = ensureExtension(validationImport.__modulePath)
        imports.push(`import { ${exportName} as ${validationVar} } from '${modulePath}'`)
      }
    }

    // Import hooks if provided
    let hooksVar = 'undefined'
    if (resource.hooks) {
      const hooksImport = resource.hooks as any
      if (hooksImport.__modulePath) {
        const exportName = hooksImport.__exportName || resource.name + 'Hooks'
        hooksVar = `${varName}Hooks`
        const modulePath = ensureExtension(hooksImport.__modulePath)
        imports.push(`import { ${exportName} as ${hooksVar} } from '${modulePath}'`)
      } else if (typeof resource.hooks === 'object') {
        // Inline hooks - serialize directly
        hooksVar = JSON.stringify(resource.hooks)
      }
    }

    // Build registry entry
    registryEntries.push(`
  '${resource.name}': {
    name: '${resource.name}',
    schema: ${varName}Schema,
    authorization: ${authVar},
    validation: ${validationVar},
    hooks: ${hooksVar},
    metadata: ${resource.metadata ? JSON.stringify(resource.metadata) : 'undefined'},
    hiddenFields: ${resource.hiddenFields ? JSON.stringify(resource.hiddenFields) : 'undefined'},
  }`)
  })

  return `${imports.join('\n')}

export const registry = {
${registryEntries.join(',\n')}
}

export function getResource(name) {
  return registry[name]
}

export function getAllResources() {
  return Object.values(registry)
}

export const resourceNames = [${resources.map(r => `'${r.name}'`).join(', ')}]
`
}

/**
 * Generate TypeScript type declarations for the virtual module
 */
function generateVirtualModuleTypes(resources: ResourceRegistration[]): string {
  const resourceTypes = resources.map(r => `'${r.name}'`).join(' | ')

  return `import type { ResourceRegistration } from './runtime/types'

export declare const registry: Record<${resourceTypes}, ResourceRegistration>

export declare function getResource(name: ${resourceTypes}): ResourceRegistration | undefined

export declare function getAllResources(): ResourceRegistration[]

export declare const resourceNames: Array<${resourceTypes}>
`
}

/**
 * Generate virtual module that exports plugin runtime setup functions.
 *
 * Sources (merged into a single `plugins` export):
 *   1. User file path → `import _user from '~/server/autoapi-plugins'`
 *   2. Community module file paths → `import _mod0 from '...'`
 *   3. Inline plugins (legacy) → serialized via toString() (limited closure support)
 */
function generatePluginsVirtualModule(opts: {
  userFilePath: string | null
  moduleFilePaths: string[]
  inlinePlugins: AutoApiPlugin[]
}): string {
  const imports: string[] = []
  const spreadParts: string[] = []

  // 1. User file path — default export is an array of AutoApiPlugin
  if (opts.userFilePath) {
    const resolvedPath = ensureExtension(opts.userFilePath)
    imports.push(`import _userPlugins from '${resolvedPath}'`)
    spreadParts.push('..._userPlugins')
  }

  // 2. Community module file paths — each default-exports a single plugin or array
  opts.moduleFilePaths.forEach((filePath, index) => {
    const varName = `_modPlugins${index}`
    imports.push(`import ${varName} from '${ensureExtension(filePath)}'`)
    // Normalize: if module exports a single plugin, wrap in array
    spreadParts.push(`...(Array.isArray(${varName}) ? ${varName} : [${varName}])`)
  })

  // 3. Inline plugins (legacy fallback — closure variables will NOT survive serialization)
  opts.inlinePlugins.forEach((plugin, index) => {
    let runtimeSetupStr = plugin.runtimeSetup?.toString() || '() => {}'

    // Fix function serialization: "funcName(args) {}" → "function funcName(args) {}"
    if (runtimeSetupStr.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/)) {
      runtimeSetupStr = 'function ' + runtimeSetupStr
    }

    spreadParts.push(`{ name: ${JSON.stringify(plugin.name)}, runtimeSetup: ${runtimeSetupStr} }`)
  })

  const pluginsExpr = spreadParts.length > 0
    ? `[\n  ${spreadParts.join(',\n  ')}\n]`
    : '[]'

  return `${imports.join('\n')}

export const plugins = ${pluginsExpr}
`
}

export type { AutoApiOptions, SchemaRegistryAPI, AutoApiPlugin } from './runtime/types'
export { defineAutoApiPlugin } from './runtime/types/plugin'
export { createModuleImport } from './utils/moduleImport'

/**
 * Plugin registration context passed to the autoApi:registerPlugins hook.
 * Community Nuxt modules use this to register their plugin files.
 */
export interface PluginRegistrationContext {
  /**
   * Register a plugin file path.
   * The file should default-export an AutoApiPlugin or AutoApiPlugin[].
   *
   * @example
   * // In a community Nuxt module:
   * nuxt.hook('autoApi:registerPlugins', (ctx) => {
   *   ctx.addFile(resolver.resolve('./runtime/my-plugin'))
   * })
   */
  addFile(filePath: string): void
}

// Augment Nuxt hooks
declare module '@nuxt/schema' {
  interface NuxtHooks {
    'autoApi:registerSchema': (registry: BuildTimeRegistry) => void | Promise<void>
    'autoApi:registerPlugins': (ctx: PluginRegistrationContext) => void | Promise<void>
  }
}

// BuildTimeRegistry is already exported as an interface declaration above
