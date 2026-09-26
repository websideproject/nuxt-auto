import { defineNuxtModule, createResolver, addServerHandler, addServerImportsDir, addServerImports, addTemplate, addTypeTemplate, addPlugin, addImportsDir, useLogger, resolvePath } from '@nuxt/kit'
import { existsSync } from 'node:fs'
import { PUBLIC_SERVER_UTILS } from './runtime/server/publicServerUtils'
import type { AutoApiOptions, ResourceRegistration, AutoApiPlugin } from './runtime/types'
import type { PluginBuildContext } from './runtime/types/plugin'

export type ModuleOptions = Partial<AutoApiOptions>

export interface BuildTimeRegistry {
  resources: Map<string, ResourceRegistration>
  register(name: string, config: Omit<ResourceRegistration, 'name'>): void
  getAll(): ResourceRegistration[]
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-auto-api',
    configKey: 'autoApi',
    compatibility: { nuxt: '>=4.0.0' },
  },
  defaults: {
    prefix: '/api',
    pagination: {
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

    // Server auto-imports: exactly the public API (`@websideproject/nuxt-auto-api/utils`). Internal helpers
    // are never auto-imported, so they cannot collide with the app's or another module's names.
    // Resolve to the exact file: an extensionless `…/utils.public` gets its `.public` read as an extension by
    // the server import pipeline and resolves to the `utils/` directory instead.
    const publicUtilsFile = await resolvePath(resolver.resolve('./runtime/server/utils.public'))
    addServerImports(PUBLIC_SERVER_UTILS.map(name => ({ name, from: publicUtilsFile })))

    // Alias sub-path exports so they always resolve to source — works in both stub and full-build modes
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.alias = nitroConfig.alias || {}
      nitroConfig.alias['@websideproject/nuxt-auto-api/plugins'] = resolver.resolve('./runtime/plugins/index')
      nitroConfig.alias['@websideproject/nuxt-auto-api/database'] = resolver.resolve('./runtime/server/database/index')
      nitroConfig.alias['@websideproject/nuxt-auto-api/utils'] = resolver.resolve('./runtime/server/utils.public')
    })

    const logger = useLogger('nuxt-auto-api', { level: options.debug ? 4 : 3 })

    // Options that took functions reached the server through runtimeConfig, which is serialized — the
    // functions were silently dropped. They are removed; fail loudly instead of silently mis-scoping.
    const mt = options.multiTenancy as Record<string, unknown> | undefined
    for (const removed of ['getTenantId', 'allowCrossTenantAccess', 'requireTenant']) {
      if (mt && removed in mt) {
        throw new Error(`[nuxt-auto-api] autoApi.multiTenancy.${removed} was removed: resolve the tenant on the server (set event.context.tenantId, ctx.user.${String(mt.userTenantField || mt.tenantIdField || 'organizationId')}, or ctx.tenant from a context extender). See the multi-tenancy docs.`)
      }
    }
    for (const removed of ['hooks', 'exclude', 'include']) {
      if (removed in (options as Record<string, unknown>)) {
        throw new Error(`[nuxt-auto-api] autoApi.${removed} was removed${removed === 'hooks' ? ': register hooks on the resource (createModuleImport) or through a plugin' : ''}.`)
      }
    }

    // Runtime config: data only (inline plugin objects hold functions and are wired separately below).
    const { plugins: _plugins, ...serializable } = options as Record<string, unknown>
    nuxt.options.runtimeConfig.autoApi = serializable as unknown as typeof nuxt.options.runtimeConfig.autoApi
    // The client composables need the prefix too.
    nuxt.options.runtimeConfig.public.autoApi = {
      ...(nuxt.options.runtimeConfig.public.autoApi as Record<string, unknown> | undefined),
      prefix: options.prefix || '/api',
    }

    // Create build-time registry
    const registry: BuildTimeRegistry = {
      resources: new Map(),
      register(name: string, config: Omit<ResourceRegistration, 'name'>) {
        if (this.resources.has(name)) {
          throw new Error(`[nuxt-auto-api] Resource "${name}" is already registered`)
        }
        this.resources.set(name, { name, ...config })
        logger.debug(`Registered resource: ${name}`)
      },
      getAll() {
        return Array.from(this.resources.values())
      },
    }

    // ─── Plugin System ────────────────────────────────────────────────────
    // Plugins can be registered from 3 sources:
    //   1. File path in nuxt.config.ts:  plugins: '~/server/autoapi-plugins'
    //   2. Inline array (legacy/simple): plugins: [simplePlugin]
    //   3. Community Nuxt modules:       hook 'autoApi:registerPlugins'
    // ──────────────────────────────────────────────────────────────────────

    // Collect plugin file paths from community modules via hook
    const pluginFilePaths: string[] = []

    // addFile'd plugin files are imported by the generated `#nuxt-auto-api-plugins` virtual module.
    // Inline them into the Nitro bundle so esbuild applies a full TypeScript transform (enums,
    // parameter properties, etc.) instead of a strip-only load. This runs late enough that
    // pluginFilePaths has been populated by the autoApi:registerPlugins hook (modules:done).
    nuxt.hook('nitro:config', (nitroConfig) => {
      if (pluginFilePaths.length === 0) return
      nitroConfig.externals = nitroConfig.externals || {}
      nitroConfig.externals.inline = nitroConfig.externals.inline || []
      for (const filePath of pluginFilePaths) {
        if (!nitroConfig.externals.inline.includes(filePath)) {
          nitroConfig.externals.inline.push(filePath)
        }
      }
    })

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
      }
      else if (resolved.startsWith('~/') || resolved.startsWith('~\\')) {
        resolved = resolved.replace(/^~/, nuxt.options.rootDir)
      }
      userPluginFilePath = resolved
      logger.debug(`Plugin file: ${userPlugins} → ${userPluginFilePath}`)
    }
    else if (Array.isArray(userPlugins)) {
      // Inline array (legacy/simple plugins)
      inlinePlugins = userPlugins
      logger.warn('Inline plugins in nuxt.config.ts cannot capture variables (they are serialized). Prefer a file: plugins: \'~/server/autoapi-plugins\'')
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
          info: (...args: any[]) => logger.info(`[plugin:${plugin.name}]`, ...args),
          warn: (...args: any[]) => logger.warn(`[plugin:${plugin.name}]`, ...args),
          error: (...args: any[]) => logger.error(`[plugin:${plugin.name}]`, ...args),
          debug: (...args: any[]) => logger.debug(`[plugin:${plugin.name}]`, ...args),
        },
      }

      try {
        await plugin.buildSetup(buildContext)
        logger.debug(`Plugin "${plugin.name}" build setup complete`)
      }
      catch (error) {
        logger.error(`Plugin "${plugin.name}" build setup failed:`, error)
        throw error
      }
    }

    // hasPlugins is checked after modules:done populates pluginFilePaths
    const hasPlugins = !!userPluginFilePath || inlinePlugins.some(p => p.runtimeSetup)

    // Generate virtual module for plugins
    addTemplate({
      filename: 'nuxt-auto-api-plugins.mjs',
      getContents: () => {
        const content = generatePluginsVirtualModule({
          userFilePath: userPluginFilePath,
          moduleFilePaths: pluginFilePaths,
          inlinePlugins: inlinePlugins.filter(p => p.runtimeSetup),
        })
        logger.debug('Generated plugin virtual module:\n' + content)
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

    if (hasPlugins) logger.debug('Plugin system initialized')

    // After all modules loaded, call hook and generate virtual module
    nuxt.hook('modules:done', async () => {
      // Let other modules register plugin files — must run in modules:done so all
      // modules have already had a chance to call nuxt.hook('autoApi:registerPlugins')
      await nuxt.callHook('autoApi:registerPlugins' as any, {
        addFile(filePath: string) {
          pluginFilePaths.push(filePath)
          logger.debug(`Plugin file registered via hook: ${filePath}`)
        },
      })

      // Call hook to let other modules register resources
      await nuxt.callHook('autoApi:registerSchema' as any, registry)
      const resources = registry.getAll()

      if (resources.length === 0) {
        logger.warn('No resources registered')
        return
      }

      // Deny by default: a resource without authorization refuses every operation. Say so at build time.
      const unauthorized = resources.filter(r => !r.authorization).map(r => r.name)
      if (unauthorized.length) {
        logger.warn(`${unauthorized.length} resource(s) declare no authorization, so every request to them is refused: ${unauthorized.join(', ')}. Add \`authorization\` (use \`true\` for public operations).`)
      }
      logger.debug(`Registering ${resources.length} resources`)

      // Generate virtual module with all resource imports
      const virtualModuleContent = generateVirtualModule(resources)

      // Generate virtual module
      addTemplate({
        filename: 'nuxt-auto-api-registry.mjs',
        getContents: () => virtualModuleContent,
        write: true,
      })

      // Types for `#nuxt-auto-api-registry` in app and server code.
      addTypeTemplate({
        filename: 'types/nuxt-auto-api-registry.d.ts',
        getContents: () => generateVirtualModuleTypes(resources),
      }, { nitro: true, nuxt: true })

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

        // Restore endpoint - POST /api/{resource}/:id/restore (400 for tables without soft delete)
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
      }

      // Global permissions endpoint - GET /api/permissions
      // Returns permissions for all resources in a single request
      addServerHandler({
        route: `${prefix}/permissions`,
        method: 'get',
        handler: resolver.resolve('./runtime/server/handlers/allPermissions.entry'),
      })

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

      logger.debug('All routes registered')
    }) // end modules:done hook
  },
})

/**
 * Resolve an extensionless module path to the file that exists (`.ts`, `.mts`, `.js`, `.mjs`, or an
 * `index.*` inside a directory). The generated registry imports these paths directly, so they must be exact.
 */
function ensureExtension(path: string): string {
  if (/\.[cm]?[jt]s$/.test(path)) return path
  for (const ext of ['.ts', '.mts', '.js', '.mjs']) {
    if (existsSync(path + ext)) return path + ext
  }
  for (const ext of ['.ts', '.mts', '.js', '.mjs']) {
    if (existsSync(`${path}/index${ext}`)) return `${path}/index${ext}`
  }
  return `${path}.ts`
}

/**
 * Generate virtual module content that exports the resource registry. Exported for tests.
 */
export function generateVirtualModule(resources: ResourceRegistration[]): string {
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
    }
    else {
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
      else {
        throw new Error(`[nuxt-auto-api] Resource "${resource.name}" authorization must use createModuleImport()`)
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
      else {
        // Zod schemas cannot be serialized into the generated module — an inline one used to be dropped
        // silently, leaving the resource on its generated schemas.
        throw new Error(`[nuxt-auto-api] Resource "${resource.name}" validation must use createModuleImport()`)
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
      }
      else {
        // Functions cannot be serialized into the generated module — they used to be dropped silently.
        throw new Error(`[nuxt-auto-api] Resource "${resource.name}" hooks must use createModuleImport()`)
      }
    }

    // Build registry entry
    registryEntries.push(`
  ${JSON.stringify(resource.name)}: {
    name: ${JSON.stringify(resource.name)},
    schema: ${varName}Schema,
    authorization: ${authVar},
    validation: ${validationVar},
    hooks: ${hooksVar},
    metadata: ${resource.metadata ? JSON.stringify(resource.metadata) : 'undefined'},
    hiddenFields: ${resource.hiddenFields ? JSON.stringify(resource.hiddenFields) : 'undefined'},
    protectedFields: ${resource.protectedFields ? JSON.stringify(resource.protectedFields) : 'undefined'},
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

export const resourceNames = ${JSON.stringify(resources.map(r => r.name))}
`
}

/**
 * Generate TypeScript type declarations for the virtual module
 */
function generateVirtualModuleTypes(resources: ResourceRegistration[]): string {
  const names = resources.map(r => JSON.stringify(r.name)).join(' | ') || 'string'
  return `declare module '#nuxt-auto-api-registry' {
  import type { ResourceRegistration } from '@websideproject/nuxt-auto-api'
  export type ResourceName = ${names}
  export const registry: Record<ResourceName, ResourceRegistration>
  export function getResource(name: ResourceName): ResourceRegistration | undefined
  export function getAllResources(): ResourceRegistration[]
  export const resourceNames: ResourceName[]
}
export {}
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
  opts.inlinePlugins.forEach((plugin) => {
    let runtimeSetupStr = plugin.runtimeSetup?.toString() || '() => {}'

    // Fix function serialization: "funcName(args) {}" → "function funcName(args) {}"
    if (runtimeSetupStr.match(/^[a-z_$][\w$]*\s*\(/i)) {
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

export type {
  AutoApiOptions,
  SchemaRegistryAPI,
  AutoApiPlugin,
  ResourceRegistration,
  ResourceAuthConfig,
  ResourceHooks,
  HandlerContext,
  PermissionValue,
  PermissionFunction,
  MultiTenancyConfig,
  ValidationSchema,
} from './runtime/types'
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
   *
   * Authoring constraints — the file (and everything it imports) is loaded via the generated
   * `#nuxt-auto-api-plugins` virtual module, not scanned as a Nitro server file:
   *  - **Use the plugin runtime context, not Nitro auto-imports.** Read config via
   *    `runtimeSetup(ctx) { ctx.runtimeConfig }`, not a bare `useRuntimeConfig()`.
   *  - **Import siblings via package-subpath, not deep relative paths**, so resolution is stable.
   *  - The file is inlined into the bundle (full TS transform), so enums / parameter properties
   *    are fine — but a plugin that only needs the request context (no `ctx` registrar work) is
   *    better written as a Nitro server plugin that calls `addContextExtender` /
   *    `registerPermissionEvaluator` from `@websideproject/nuxt-auto-api/plugins`.
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
