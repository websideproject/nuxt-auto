import { getRequestHeaders, getRequestIP, type H3Event } from 'h3'
import type { HandlerContext, AutoApiPlugin } from '../types'
import { defineAutoApiPlugin } from '../types/plugin'

/**
 * Custom mapper function signature.
 * Receives metadata, current data, and full context.
 * Returns modified data object (can mutate or return new object).
 */
export type MetadataMapper = (
  metadata: Record<string, any>,
  data: any,
  context: HandlerContext
) => any | Promise<any>

/**
 * JSON field storage configuration.
 */
export interface JsonFieldConfig {
  /** Column name for JSON storage */
  json: string
  /** Optional path to nest metadata under (e.g., 'signup' -> { signup: { ip, country } }) */
  path?: string
  /** Whether to merge with existing JSON data. Default: true */
  merge?: boolean
}

export interface RequestMetadataPluginOptions {
  /**
   * Function to extract metadata from the H3 event.
   *
   * @param event - The H3 request event
   * @returns Object with metadata keys (ip, country, city, etc.)
   *
   * Default: Extracts from Cloudflare headers (CF-Connecting-IP, CF-IPCountry, etc.)
   * Falls back to X-Forwarded-For / X-Real-IP for non-Cloudflare environments.
   *
   * @example Custom MaxMind GeoIP extractor
   * ```typescript
   * extract: async (event) => {
   *   const ip = getRequestIP(event)
   *   const geo = await geoip.lookup(ip)
   *   return {
   *     ip,
   *     country: geo?.country,
   *     city: geo?.city,
   *     customField: 'value'
   *   }
   * }
   * ```
   */
  extract?: (event: H3Event) => Record<string, any> | Promise<Record<string, any>>

  /**
   * Configure how metadata is stored in the database.
   *
   * **Option 1: Direct column mapping** (simple)
   * ```typescript
   * autoPopulate: {
   *   ip: 'signupIp',
   *   country: 'signupCountry'
   * }
   * // Result: data.signupIp = '1.2.3.4', data.signupCountry = 'US'
   * ```
   *
   * **Option 2: JSON field storage** (nested)
   * ```typescript
   * autoPopulate: {
   *   json: 'metadata',  // Store all metadata in a JSON column
   *   path: 'signup'     // Optional: nest under a path
   * }
   * // Result: data.metadata = { signup: { ip: '...', country: '...', ... } }
   * ```
   *
   * **Option 3: Custom mapper function** (full control)
   * ```typescript
   * autoPopulate: (metadata, data, context) => {
   *   // Custom logic for how to store metadata
   *   data.meta = { ...data.meta, ...metadata }
   *   data.signupSource = metadata.country === 'US' ? 'domestic' : 'international'
   *   return data
   * }
   * ```
   *
   * **Option 4: Disable** (context-only, no DB storage)
   * ```typescript
   * autoPopulate: false
   * ```
   *
   * Default: `false` (disabled - metadata only in context)
   */
  autoPopulate?:
    | Record<string, string>  // Column mapping: { ip: 'signupIp', country: 'signupCountry' }
    | JsonFieldConfig         // JSON field: { json: 'metadata', path: 'signup', merge: true }
    | MetadataMapper          // Custom mapper: (metadata, data, ctx) => data
    | false                   // Disabled: context-only, no DB storage

  /**
   * Which operations to auto-populate on.
   *
   * Default: `['create']` (only populate on new records)
   *
   * @example Populate on both create and update
   * ```typescript
   * autoPopulateOn: ['create', 'update']
   * ```
   */
  autoPopulateOn?: Array<'create' | 'update'>

  /**
   * Resources to enable auto-population for.
   * If not specified, applies to all resources.
   *
   * @example Only auto-populate for users and orders
   * ```typescript
   * resources: ['users', 'orders']
   * ```
   */
  resources?: string[]
}

/**
 * Default extractor: Cloudflare headers + User-Agent
 */
function defaultExtract(event: H3Event): Record<string, any> {
  const headers = getRequestHeaders(event)

  // Try Cloudflare headers first
  const ip = headers['cf-connecting-ip'] ||
             headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             headers['x-real-ip'] ||
             getRequestIP(event)

  return {
    ip,
    country: headers['cf-ipcountry'],
    city: headers['cf-ipcity'],
    region: headers['cf-ipregion'],
    timezone: headers['cf-timezone'],
    latitude: headers['cf-iplatitude'],
    longitude: headers['cf-iplongitude'],
    userAgent: headers['user-agent'],
  }
}

export function createRequestMetadataPlugin(
  options: RequestMetadataPluginOptions = {}
): AutoApiPlugin {
  const {
    extract = defaultExtract,
    autoPopulate = false,
    autoPopulateOn = ['create'],
    resources,
  } = options

  return defineAutoApiPlugin({
    name: 'request-metadata',
    version: '1.0.0',

    runtimeSetup(ctx) {
      console.log('[RequestMetadataPlugin] Initializing...')

      // PART 1: Context enrichment (always runs)
      ctx.extendContext(async (context) => {
        try {
          const metadata = await extract(context.event)
          context.requestMeta = metadata
        } catch (error) {
          ctx.logger?.warn('Failed to extract request metadata:', error)
          context.requestMeta = {} // Set empty object to avoid undefined checks
        }
      })

      // PART 2: Auto-population (optional)
      if (autoPopulate !== false) {
        console.log('[RequestMetadataPlugin] Auto-populate enabled, autoPopulateOn:', autoPopulateOn, 'resources:', resources)
        const populateData = async (data: any, context: HandlerContext) => {
          // Skip if resource filtering is enabled and resource not in list
          if (resources && !resources.includes(context.resource)) {
            return data
          }

          // Skip if no metadata available
          if (!context.requestMeta) {
            return data
          }

          // STRATEGY 1: Custom mapper function
          if (typeof autoPopulate === 'function') {
            return await autoPopulate(context.requestMeta, data, context)
          }

          // Get resource schema to check which columns exist
          const table = context.schema?.[context.resource]
          if (!table) {
            return data
          }

          const columns = Object.keys(table)

          // STRATEGY 2: JSON field storage
          if ('json' in autoPopulate) {
            const jsonColumn = autoPopulate.json
            const path = autoPopulate.path
            const merge = autoPopulate.merge ?? true

            // Only populate if JSON column exists
            if (!columns.includes(jsonColumn)) {
              return data
            }

            // Get existing JSON data
            const existingData = data[jsonColumn] || {}

            // Store metadata
            if (path) {
              // Nested: { metadata: { signup: { ip, country, ... } } }
              data[jsonColumn] = {
                ...(merge ? existingData : {}),
                [path]: context.requestMeta
              }
            } else {
              // Top-level merge: { metadata: { ip, country, ... } }
              data[jsonColumn] = {
                ...(merge ? existingData : {}),
                ...context.requestMeta
              }
            }

            return data
          }

          // STRATEGY 3: Direct column mapping (default)
          for (const [metaKey, columnName] of Object.entries(autoPopulate)) {
            // Only populate if:
            // 1. Column exists in schema
            // 2. Value exists in metadata
            // 3. User hasn't explicitly set the value
            if (
              columns.includes(columnName) &&
              context.requestMeta[metaKey] !== undefined &&
              data[columnName] === undefined
            ) {
              data[columnName] = context.requestMeta[metaKey]
            }
          }

          return data
        }

        // Register before hooks based on autoPopulateOn config
        const hooks: any = {}

        if (autoPopulateOn.includes('create')) {
          hooks.beforeCreate = populateData
        }

        if (autoPopulateOn.includes('update')) {
          hooks.beforeUpdate = async (_id: any, data: any, context: HandlerContext) => {
            console.log('[RequestMetadataPlugin] beforeUpdate hook called for resource:', context.resource)
            return await populateData(data, context)
          }
        }

        console.log('[RequestMetadataPlugin] Registering global hooks:', Object.keys(hooks))
        ctx.addGlobalHook(hooks)
      }
    },
  })
}
