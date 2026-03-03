import {
  defineNuxtModule,
  addPlugin,
  createResolver,
  addComponent,
  addImportsDir,
  addTemplate,
  addLayout,
  addServerHandler,
} from '@nuxt/kit'
import type { ModuleOptions } from './runtime/types'
import type { BuildTimeRegistry } from '@websideproject/nuxt-auto-api'

export type { ModuleOptions }

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-auto-admin',
    configKey: 'autoAdmin',
  },
  defaults: {
    prefix: '/admin',
    branding: {
      title: 'Admin Panel',
    },
    features: {
      bulkActions: true,
      search: true,
      filters: true,
      export: true,
      import: false,
      auditLog: false,
    },
    permissions: {
      unauthorizedButtons: 'disable',
      unauthorizedSidebarItems: 'hide',
    },
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Add tailwindcss support
    nuxt.options.css.unshift(resolver.resolve('./runtime/assets/css/main.css'))

    // Add runtime config
    nuxt.options.runtimeConfig.public.autoAdmin = {
      prefix: options.prefix,
      branding: options.branding,
      features: options.features,
      permissions: options.permissions,
      customPages: options.customPages || [],
    }

    // Hook into autoApi:registerSchema to capture resource registrations.
    // Store the registry REFERENCE (not a snapshot) because other modules (e.g. the
    // app's base module) register their resources in later callbacks of the same hook.
    // The api module calls callHook('autoApi:registerSchema', registry) in its own
    // modules:done, which runs before this module's modules:done. By the time our
    // modules:done fires, all subscribers have populated the registry.
    let capturedRegistry: BuildTimeRegistry | null = null

    nuxt.hook('autoApi:registerSchema' as any, async (registry: BuildTimeRegistry) => {
      capturedRegistry = registry
    })

    // After modules are done, generate admin registry
    nuxt.hook('modules:done', async () => {
      const capturedResources = capturedRegistry?.getAll() ?? []

      if (capturedResources.length === 0) {
        console.warn('[nuxt-auto-admin] No resources found. Make sure nuxt-auto-api is installed and resources are registered.')
        return
      }

      console.log(`[nuxt-auto-admin] Found ${capturedResources.length} resources`)

      // Generate virtual module with introspected schemas
      const virtualModuleContent = generateAdminRegistry(capturedResources, options)

      addTemplate({
        filename: 'nuxt-auto-admin-registry.mjs',
        getContents: () => virtualModuleContent,
        write: true,
      })

      addTemplate({
        filename: 'nuxt-auto-admin-registry.d.ts',
        getContents: () => generateAdminRegistryTypes(capturedResources),
        write: true,
      })

      // Register virtual module alias
      nuxt.options.alias['#nuxt-auto-admin-registry'] = resolver.resolve(
        nuxt.options.buildDir,
        'nuxt-auto-admin-registry.mjs'
      )

      console.log('[nuxt-auto-admin] ✓ Generated admin registry')
    })

    // Add runtime plugin
    addPlugin(resolver.resolve('./runtime/plugin'))

    // Add composables
    addImportsDir(resolver.resolve('./runtime/composables'))

    // Register admin layout
    addLayout({
      src: resolver.resolve('./runtime/layouts/admin.vue'),
      filename: 'admin.vue',
    })

    // Auto-register components (no prefix for easier usage)
    nuxt.hook('components:dirs', (dirs) => {
      dirs.push({
        path: resolver.resolve('./runtime/components'),
        pathPrefix: false,
      })
    })

    // Register admin pages (order matters - more specific routes first)
    nuxt.hook('pages:extend', (pages) => {
      const adminPrefix = options.prefix || '/admin'

      const adminPages = [
        {
          name: 'admin',
          path: adminPrefix,
          file: resolver.resolve('./runtime/pages/admin/index.vue'),
        },
        {
          name: 'admin-resource-create',
          path: `${adminPrefix}/:resource/new`,
          file: resolver.resolve('./runtime/pages/admin/[resource]/new.vue'),
        },
        {
          name: 'admin-resource-edit',
          path: `${adminPrefix}/:resource/:id/edit`,
          file: resolver.resolve('./runtime/pages/admin/[resource]/[id]/edit.vue'),
        },
        {
          name: 'admin-resource-detail',
          path: `${adminPrefix}/:resource/:id`,
          file: resolver.resolve('./runtime/pages/admin/[resource]/[id].vue'),
        },
        {
          name: 'admin-resource-list',
          path: `${adminPrefix}/:resource`,
          file: resolver.resolve('./runtime/pages/admin/[resource]/index.vue'),
        },
      ]

      pages.push(...adminPages)

      console.log(`[nuxt-auto-admin] ✓ Registered ${adminPages.length} admin pages`)
    })

    // Add middleware directory for route middleware
    // The admin-auth middleware can be used in pages via definePageMeta
    nuxt.hook('imports:dirs', (dirs) => {
      dirs.push(resolver.resolve('./runtime/middleware'))
    })

    // Register server API routes
    addServerHandler({
      route: '/api/admin/m2m/sync',
      handler: resolver.resolve('./runtime/server/api/admin/m2m/sync.post'),
      method: 'post',
    })

    console.log('[nuxt-auto-admin] ✓ Module setup complete')
  },
})

/**
 * Generate admin registry virtual module
 */
function generateAdminRegistry(resources: any[], options: ModuleOptions): string {
  const imports: string[] = []
  const registryEntries: string[] = []

  // Build a map of all resource names for foreign key resolution
  const resourceNames = resources
    .filter(r => !(options.resources?.[r.name]?.disabled))
    .map(r => r.name)

  resources.forEach((resource, index) => {
    const resourceConfig = options.resources?.[resource.name] || {}

    // Skip disabled resources
    if (resourceConfig.disabled) {
      return
    }

    const varName = `resource${index}`

    // Import schema for introspection
    const schemaImport = resource.schema as any
    if (schemaImport.__modulePath) {
      const exportName = schemaImport.__exportName || resource.name
      const modulePath = ensureExtension(schemaImport.__modulePath)
      imports.push(`import { ${exportName} as ${varName}Schema } from '${modulePath}'`)
    }

    // Build resource schema entry
    const schemaEntry = buildResourceSchemaEntry(resource, resourceConfig, varName, resourceNames)
    registryEntries.push(schemaEntry)
  })

  return `${imports.join('\n')}

// Utility functions needed for schema introspection
function formatFieldLabel(fieldName) {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\\b\\w/g, (char) => char.toUpperCase())
    .trim()
}

function mapColumnTypeToWidget(column) {
  const { name, type, dataType, enumValues, foreignKey } = column

  if (foreignKey) return 'RelationSelect'
  if (enumValues && enumValues.length > 0) return 'SelectInput'
  if (name.toLowerCase().includes('password')) return 'PasswordInput'

  const lowerType = (type || dataType || '').toLowerCase()

  if (lowerType.includes('boolean') || (lowerType.includes('integer') && name.startsWith('is'))) {
    return 'CheckboxInput'
  }

  if (
    lowerType.includes('integer') ||
    lowerType.includes('number') ||
    lowerType.includes('decimal') ||
    lowerType.includes('float') ||
    lowerType.includes('real') ||
    lowerType.includes('numeric')
  ) {
    return 'NumberInput'
  }

  if (
    lowerType.includes('timestamp') ||
    lowerType.includes('datetime') ||
    lowerType.includes('date') ||
    name.toLowerCase().endsWith('at') ||
    name.toLowerCase().endsWith('date')
  ) {
    return 'DateTimePicker'
  }

  if (
    lowerType === 'text' ||
    name.toLowerCase().includes('description') ||
    name.toLowerCase().includes('content') ||
    name.toLowerCase().includes('body') ||
    name.toLowerCase().includes('bio') ||
    name.toLowerCase().includes('notes')
  ) {
    return 'TextareaInput'
  }

  if (lowerType.includes('json')) return 'JsonEditor'

  return 'TextInput'
}

const config = ${JSON.stringify(options, null, 2)}

export const registry = {
${registryEntries.join(',\n')}
}

export function getResource(name) {
  return registry[name]
}

export function getAllResources() {
  return Object.values(registry)
}

export function getResourcesByGroup() {
  const grouped = {}
  Object.values(registry).forEach(resource => {
    const group = resource.group || 'Default'
    if (!grouped[group]) {
      grouped[group] = []
    }
    grouped[group].push(resource)
  })
  return grouped
}

export const resourceNames = [${resources.map(r => `'${r.name}'`).join(', ')}]
export const adminConfig = config
`
}

/**
 * Build resource schema entry with introspection
 */
function buildResourceSchemaEntry(
  resource: any,
  config: any,
  varName: string,
  allResourceNames: string[]
): string {
  const displayName = config.displayName || formatResourceName(resource.name)
  const icon = config.icon || 'i-heroicons-table-cells'

  // Generate code that will execute at runtime to introspect the schema
  return `  '${resource.name}': (() => {
    // Introspect schema columns
    const schema = ${varName}Schema
    const columns = []
    const availableResources = ${JSON.stringify(allResourceNames)}

    const columnsSymbol = Symbol.for('drizzle:Columns')
    const schemaColumns = schema[columnsSymbol]

    if (schemaColumns) {
      for (const [name, col] of Object.entries(schemaColumns)) {
        const metadata = {
          name,
          type: col.columnType || 'unknown',
          dataType: col.dataType,
          isPrimaryKey: col.primary || false,
          isAutoIncrement: col.hasDefault && col.default === 'auto_increment',
          isNullable: !col.notNull,
          isUnique: col.isUnique || false,
          // Sanitize defaultValue - exclude SQL objects that can't be serialized
          defaultValue: (col.default && typeof col.default === 'object' && 'queryChunks' in col.default)
            ? undefined
            : col.default,
          enumValues: col.enumValues || undefined,
        }

        // Check for foreign key - use smarter detection
        if (name.endsWith('Id')) {
          // Try to find the referenced resource
          const baseName = name.slice(0, -2) // userId -> user

          // Try different variations to find the actual resource
          let targetResource = null

          // 1. Check if there's a Drizzle foreign key reference
          if (col.references) {
            // Extract the table name from the Drizzle reference
            const referencedTable = col.references()
            if (referencedTable && referencedTable.constructor && referencedTable.constructor.name) {
              targetResource = referencedTable.constructor.name
            }
          }

          // 2. Try to match against registered resources
          if (!targetResource) {
            // Try plural form (user -> users)
            const pluralForm = baseName + 's'
            if (availableResources.includes(pluralForm)) {
              targetResource = pluralForm
            }
            // Try exact match
            else if (availableResources.includes(baseName)) {
              targetResource = baseName
            }
            // Try common irregular plurals
            else if (baseName.endsWith('y')) {
              const iesForm = baseName.slice(0, -1) + 'ies'
              if (availableResources.includes(iesForm)) {
                targetResource = iesForm
              }
            }
          }

          // Only add foreign key if we found a matching resource
          if (targetResource) {
            metadata.foreignKey = {
              table: targetResource,
              column: 'id',
            }
          }
        }

        columns.push(metadata)
      }
    }

    // Find primary key
    const pk = columns.find(col => col.isPrimaryKey)
    const primaryKey = pk ? pk.name : 'id'

    // Auto-generate list fields
    let listFields = ${config.listFields ? JSON.stringify(config.listFields) : 'null'}
    if (!listFields) {
      listFields = [primaryKey]

      // Add title/name field (most likely display field)
      const titleField = columns.find(col =>
        !col.isPrimaryKey &&
        (col.name === 'title' || col.name === 'name' || col.name === 'displayName')
      )
      if (titleField) listFields.push(titleField.name)

      // Add content/description field (shorter text fields)
      const contentField = columns.find(col =>
        !col.isPrimaryKey &&
        !listFields.includes(col.name) &&
        (col.name === 'content' || col.name === 'description' || col.name === 'summary') &&
        (col.type?.includes('varchar') || col.dataType?.includes('varchar'))
      )
      if (contentField) listFields.push(contentField.name)

      // Add boolean status fields
      const statusFields = columns.filter(col =>
        !listFields.includes(col.name) &&
        (col.name === 'published' || col.name === 'isActive' || col.name === 'status' || col.name === 'state')
      ).map(col => col.name)
      listFields.push(...statusFields.slice(0, 1))

      // Add foreign key reference fields (userId, categoryId, etc)
      const refFields = columns.filter(col =>
        !listFields.includes(col.name) &&
        col.foreignKey &&
        col.name !== 'organizationId' // Skip multi-tenancy field
      ).map(col => col.name).slice(0, 1)
      listFields.push(...refFields)

      // Add publishedAt or createdAt (but not both updatedAt and createdAt)
      const publishedAt = columns.find(col => col.name === 'publishedAt')
      if (publishedAt) {
        listFields.push('publishedAt')
      } else {
        const createdAt = columns.find(col => col.name === 'createdAt')
        if (createdAt) listFields.push('createdAt')
      }

      // Limit to 6 columns for readability
      listFields = listFields.slice(0, 6)
    }

    // Auto-generate form fields
    const generateFormFields = (mode) => {
      const fields = []

      for (const col of columns) {
        // Skip certain fields
        if (col.isPrimaryKey && col.isAutoIncrement) continue
        if (col.name === 'createdAt' || col.name === 'updatedAt') continue
        if (col.name === 'deletedAt') continue

        const field = {
          name: col.name,
          label: formatFieldLabel(col.name),
          widget: mapColumnTypeToWidget(col),
          required: !col.isNullable && !col.defaultValue,
          readonly: mode === 'edit' && col.name.endsWith('Id') && col.name !== 'userId',
        }

        // Add widget options
        if (col.enumValues) {
          field.options = {
            enumValues: col.enumValues,
          }
        }

        if (col.foreignKey) {
          field.options = {
            resource: col.foreignKey.table,
            displayField: 'name',
          }
        }

        fields.push(field)
      }

      return fields
    }

    const formFields = ${config.formFields ? JSON.stringify(config.formFields) : 'null'} || {
      create: generateFormFields('create'),
      edit: generateFormFields('edit'),
    }

    return {
      name: '${resource.name}',
      displayName: '${displayName}',
      icon: '${icon}',
      columns,
      primaryKey,
      listFields,
      formFields,
      hiddenFields: ${JSON.stringify(config.hiddenFields || [])},
      readonlyFields: ${JSON.stringify(config.readonlyFields || [])},
      actions: ${JSON.stringify(config.actions || {})},
      group: ${config.group ? `'${config.group}'` : 'undefined'},
      order: ${config.order || 0},
      disabled: false,
      type: ${config.type ? `'${config.type}'` : "'resource'"},
    }
  })()`
}

/**
 * Format resource name for display
 */
function formatResourceName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Ensure module path has extension
 */
function ensureExtension(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.js') || path.endsWith('.mjs')) {
    return path
  }
  return `${path}.ts`
}

/**
 * Generate TypeScript types for admin registry
 */
function generateAdminRegistryTypes(resources: any[]): string {
  const resourceTypes = resources.map(r => `'${r.name}'`).join(' | ')

  return `import type { ResourceSchema, AdminRegistry } from './runtime/types'

export declare const registry: Record<${resourceTypes}, ResourceSchema>

export declare function getResource(name: ${resourceTypes}): ResourceSchema | undefined

export declare function getAllResources(): ResourceSchema[]

export declare function getResourcesByGroup(): Record<string, ResourceSchema[]>

export declare const resourceNames: Array<${resourceTypes}>

export declare const adminConfig: any
`
}
