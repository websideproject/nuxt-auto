import type { SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { M2MPermissionConfig } from './m2m'
import type { DatabaseEngine } from './database'
import type { AutoApiPlugin } from './plugin'

export interface AutoApiOptions {
  /**
   * API route prefix
   * @default '/api'
   */
  prefix?: string

  /**
   * Database configuration
   */
  database: {
    client: DatabaseEngine
    url?: string
  }

  /**
   * Authorization configuration per resource
   */
  authorization?: Record<string, ResourceAuthConfig>

  /**
   * Pagination configuration
   */
  pagination?: {
    default: 'offset' | 'cursor'
    defaultLimit: number
    maxLimit: number
  }

  /**
   * Multi-tenancy configuration
   */
  multiTenancy?: MultiTenancyConfig

  /**
   * Plugins for extending the auto-api.
   *
   * **File path (recommended):**
   * Point to a server file that exports an array of plugins.
   * Full closure support, imports work naturally.
   * ```ts
   * plugins: '~/server/autoapi-plugins'
   * ```
   *
   * **Inline array (limited):**
   * Only works for plugins with no closure variables in runtimeSetup.
   * ```ts
   * plugins: [mySimplePlugin]
   * ```
   */
  plugins?: string | AutoApiPlugin[]

  /**
   * Resources to exclude from auto-generation
   */
  exclude?: string[]

  /**
   * Resources to include in auto-generation (if not specified, all are included)
   */
  include?: string[]

  /**
   * Nested relations configuration
   */
  relations?: {
    maxDepth?: number // default: 3
    allowFieldSelection?: boolean // default: true
    allowFiltering?: boolean // default: true
    allowPagination?: boolean // default: true
  }

  /**
   * Bulk operations configuration
   */
  bulk?: {
    enabled?: boolean // default: true
    maxBatchSize?: number // default: 100
    transactional?: boolean // default: true
  }

  /**
   * Aggregations configuration
   */
  aggregations?: {
    enabled?: boolean // default: true
    allowGroupBy?: boolean // default: true
    maxGroupByFields?: number // default: 5
  }

  /**
   * Hooks configuration (config-based hooks)
   */
  hooks?: Record<string, ResourceHooks>

  /**
   * Hook execution configuration
   */
  hookConfig?: {
    errorHandling?: 'throw' | 'log' // default: 'log' for after hooks
    timeout?: number // ms, default: 5000
    parallel?: boolean // execute multiple hooks in parallel, default: false
  }

  /**
   * Many-to-Many (M2M) relationships configuration
   */
  m2m?: M2MConfig

  /**
   * Hidden fields configuration (global)
   * Fields specified here will be filtered from all resources
   */
  hiddenFields?: {
    // Global fields to hide from all resources (e.g., ['password', 'apiKey'])
    global?: string[]
    // Per-resource hidden fields
    resources?: Record<string, string[]>
  }
}

export interface MultiTenancyConfig {
  /**
   * Enable multi-tenancy
   */
  enabled: boolean

  /**
   * Field name for tenant ID in tables (default: 'organizationId')
   */
  tenantIdField?: string

  /**
   * Function to extract tenant ID from request
   */
  getTenantId?: (event: H3Event) => string | number | null | Promise<string | number | null>

  /**
   * Resources to auto-scope (default: all with tenantIdField)
   */
  scopedResources?: string[] | '*'

  /**
   * Resources to exclude from scoping
   */
  excludedResources?: string[]

  /**
   * Allow cross-tenant access for specific users
   */
  allowCrossTenantAccess?: (user: AuthUser) => boolean

  /**
   * Require tenant for all requests
   */
  requireTenant?: boolean
}

export interface ResourceAuthConfig {
  /**
   * Permissions required for operations
   */
  permissions?: {
    read?: string | string[] | PermissionFunction
    create?: string | string[] | PermissionFunction
    update?: string | string[] | PermissionFunction
    delete?: string | string[] | PermissionFunction

    /**
     * M2M relationship permissions
     */
    m2m?: M2MPermissionConfig
  }

  /**
   * Object-level authorization function.
   * Applied per-item on get/update/delete, and as a post-filter on list.
   * For list operations, prefer `listFilter` for better performance and correct pagination.
   */
  objectLevel?: ObjectLevelAuthFunction

  /**
   * SQL-level filter applied to list queries (WHERE clause).
   * More efficient than objectLevel for list — runs in the DB so pagination is correct.
   * Receives the Drizzle table and handler context, returns a SQL condition or undefined.
   *
   * @example
   * ```ts
   * listFilter: (table, ctx) => {
   *   if (ctx.user?.role === 'admin') return undefined // no filter
   *   return eq(table.published, true) // non-admins see only published
   * }
   * ```
   */
  listFilter?: (table: any, ctx: HandlerContext) => any

  /**
   * Field-level authorization
   */
  fields?: {
    [fieldName: string]: {
      read?: string | string[] | PermissionFunction
      write?: string | string[] | PermissionFunction
    }
  }
}

export type PermissionFunction = (context: HandlerContext) => boolean | Promise<boolean>

export type ObjectLevelAuthFunction = (
  object: any,
  context: HandlerContext
) => boolean | Promise<boolean>

export interface HandlerContext {
  /**
   * The database instance
   */
  db: any

  /**
   * Database adapter (abstracts engine-specific behavior)
   */
  adapter?: import('./database').DatabaseAdapter

  /**
   * The Drizzle schema (tables only)
   */
  schema: any

  /**
   * Full schema including relations (for relational queries)
   */
  fullSchema?: any

  /**
   * The current authenticated user
   */
  user: AuthUser | null

  /**
   * User permissions
   */
  permissions: string[]

  /**
   * Route parameters
   */
  params: Record<string, string>

  /**
   * Query parameters
   */
  query: Record<string, any>

  /**
   * Validated data
   */
  validated: {
    body?: any
    query?: any
  }

  /**
   * The H3 event
   */
  event: H3Event

  /**
   * Resource name
   */
  resource: string

  /**
   * Operation type
   */
  operation: 'list' | 'get' | 'create' | 'update' | 'delete' | 'bulk' | 'aggregate' | 'm2m'

  /**
   * Object-level authorization check (if configured).
   * For list operations, items are post-filtered through this function.
   */
  objectLevelCheck?: ObjectLevelAuthFunction

  /**
   * SQL-level list filter from auth config (applied as WHERE clause).
   */
  listFilter?: (table: any, ctx: HandlerContext) => any

  /**
   * Current tenant information (multi-tenancy)
   */
  tenant?: {
    id: string | number
    field: string
    canAccessAllTenants: boolean
  }

  /**
   * Resource configuration from registry
   */
  resourceConfig?: ResourceRegistration

  /**
   * Full resource registry (for accessing all resource configs)
   */
  registry?: Record<string, ResourceRegistration>

  /**
   * Short-circuit the handler pipeline.
   * When set by middleware (e.g., cache plugin in pre-execute),
   * the entry handler skips the main handler and returns this data directly.
   */
  shortCircuit?: { data: any; status?: number }

  /**
   * How the current request was authenticated (e.g. 'session', 'api-token').
   * Set by auth plugins/context extenders.
   */
  authMethod?: string

  /**
   * Additional SQL filters to merge into the list handler's WHERE clause.
   * Plugins (e.g., search) push conditions here; the list handler
   * combines them with `and()`.
   */
  additionalFilters?: SQL[]

  /**
   * Request metadata extracted from the HTTP request.
   * Populated by plugins (e.g., requestMetadataPlugin).
   *
   * Default fields (if using Cloudflare headers):
   * - ip: Client IP address
   * - country: 2-letter country code (e.g., 'US')
   * - city: City name (e.g., 'San Francisco')
   * - region: Region/state (e.g., 'California')
   * - timezone: IANA timezone (e.g., 'America/Los_Angeles')
   * - latitude: Latitude coordinate
   * - longitude: Longitude coordinate
   * - userAgent: User-Agent header
   *
   * Custom plugins can add additional fields via the index signature.
   */
  requestMeta?: {
    ip?: string
    country?: string
    city?: string
    region?: string
    timezone?: string
    latitude?: string
    longitude?: string
    userAgent?: string
    [key: string]: any  // Allow custom fields from user-defined extractors
  }
}

export interface AuthUser {
  id: string | number
  email?: string
  roles?: string[]
  permissions?: string[]
  [key: string]: any
}

export interface ListQuery {
  /**
   * Filters in the format: filter[field]=value or filter[field][operator]=value
   */
  filter?: Record<string, any>

  /**
   * Sort in the format: sort=field or sort=-field (descending)
   */
  sort?: string | string[]

  /**
   * Fields to select
   */
  fields?: string | string[]

  /**
   * Relations to include
   */
  include?: string | string[]

  /**
   * Pagination: page number (offset pagination)
   */
  page?: number

  /**
   * Pagination: items per page
   */
  limit?: number

  /**
   * Pagination: cursor (cursor pagination)
   */
  cursor?: string
}

export interface ListResponse<T = any> {
  data: T[]
  meta: {
    // Offset pagination
    total?: number
    page?: number
    limit?: number
    // Cursor pagination
    cursor?: string
    nextCursor?: string
    hasMore?: boolean
    // Aggregations
    aggregates?: Record<string, any>
  }
}

export interface SingleResponse<T = any> {
  data: T
}

export interface ErrorResponse {
  error: {
    message: string
    code?: string
    details?: any
  }
}

export interface WhereClauseBuilder {
  build: (filter: Record<string, any>, table: any) => SQL | undefined
}

export interface RelationBuilder {
  build: (include: string[], schema: any) => any
}

export interface OrderByBuilder {
  build: (sort: string | string[], table: any) => any[]
}

export interface PaginationBuilder {
  build: (query: ListQuery, options: AutoApiOptions['pagination']) => {
    limit: number
    offset?: number
    cursor?: string
  }
}

export interface ValidationSchema {
  create?: any
  update?: any
  query?: any
}

export interface HandlerPipeline {
  authenticate?: (context: HandlerContext) => Promise<void>
  authorize?: (context: HandlerContext) => Promise<void>
  validate?: (context: HandlerContext) => Promise<void>
  execute: (context: HandlerContext) => Promise<any>
  transform?: (data: any, context: HandlerContext) => Promise<any>
}

/**
 * Resource lifecycle hooks
 */
export interface ResourceHooks {
  beforeCreate?: (data: any, context: HandlerContext) => Promise<any> | any
  afterCreate?: (result: any, context: HandlerContext) => Promise<any> | any
  beforeUpdate?: (id: string | number, data: any, context: HandlerContext) => Promise<any> | any
  afterUpdate?: (result: any, context: HandlerContext) => Promise<any> | any
  beforeDelete?: (id: string | number, context: HandlerContext) => Promise<void> | void
  afterDelete?: (id: string | number, context: HandlerContext) => Promise<void> | void
  beforeList?: (context: HandlerContext) => Promise<void> | void
  afterList?: (results: any[], context: HandlerContext) => Promise<any[] | void> | any[] | void
  beforeGet?: (id: string | number, context: HandlerContext) => Promise<void> | void
  afterGet?: (result: any, context: HandlerContext) => Promise<any> | any

  /**
   * M2M relationship hooks
   */
  beforeM2MSync?: (relationName: string, ids: Array<string | number>, context: HandlerContext) => Promise<any> | any
  afterM2MSync?: (relationName: string, result: any, context: HandlerContext) => Promise<void> | void
  beforeM2MAdd?: (relationName: string, ids: Array<string | number>, context: HandlerContext) => Promise<any> | any
  afterM2MAdd?: (relationName: string, result: any, context: HandlerContext) => Promise<void> | void
  beforeM2MRemove?: (relationName: string, ids: Array<string | number>, context: HandlerContext) => Promise<void> | void
  afterM2MRemove?: (relationName: string, result: any, context: HandlerContext) => Promise<void> | void
}

/**
 * Resource registration for the schema registry (build-time)
 * Modules register with paths to their exports
 */
export interface ResourceRegistration {
  name: string
  schema: any // Drizzle table or path info at build time
  db?: any // Optional per-resource database instance
  authorization?: ResourceAuthConfig | any // Auth config or path info at build time
  validation?: ValidationSchema | any // Validation schema or path info at build time
  hooks?: ResourceHooks
  metadata?: Record<string, any>
  hiddenFields?: string[] // Fields to hide from API responses
}

/**
 * Helper to create a module import reference for build-time registration
 */
export interface ModuleImport {
  __modulePath: string
  __exportName?: string
}

/**
 * Schema registry API
 */
export interface SchemaRegistryAPI {
  register(name: string, config: Omit<ResourceRegistration, 'name'>): void
  get(name: string): ResourceRegistration | undefined
  getAll(): ResourceRegistration[]
  has(name: string): boolean
  lock(): void
  isLocked(): boolean
  mergeLegacySchema(schema: Record<string, any>, db: any, authConfig?: Record<string, ResourceAuthConfig>): void
  readonly size: number
}

/**
 * Permission check result for a resource
 */
export interface PermissionCheckResult {
  /**
   * Whether the user can create resources
   */
  canCreate: boolean

  /**
   * Whether the user can read/list resources
   */
  canRead: boolean

  /**
   * Whether the user can update resources
   */
  canUpdate: boolean

  /**
   * Whether the user can delete resources
   */
  canDelete: boolean

  /**
   * Field-level permissions (if configured)
   */
  fields?: {
    [fieldName: string]: {
      canRead: boolean
      canWrite: boolean
    }
  }
}

/**
 * Response from permission query endpoint
 */
export interface PermissionQueryResponse extends PermissionCheckResult {
  resource: string
  user: AuthUser | null
}

/**
 * Nested relation configuration for enhanced includes
 */
export interface NestedRelationConfig {
  /**
   * Fields to select from the relation
   */
  fields?: string[]

  /**
   * Filter to apply to the relation
   */
  filter?: Record<string, any>

  /**
   * Limit for the relation results
   */
  limit?: number

  /**
   * Offset for the relation results
   */
  offset?: number

  /**
   * Nested relations within this relation
   */
  with?: Record<string, NestedRelationConfig | boolean>
}

/**
 * Bulk operation request for create
 */
export interface BulkCreateRequest {
  items: any[]
}

/**
 * Bulk operation request for update
 */
export interface BulkUpdateRequest {
  items: Array<{
    id: string | number
    data: any
  }>
}

/**
 * Bulk operation request for delete
 */
export interface BulkDeleteRequest {
  ids: Array<string | number>
}

/**
 * Bulk operation response
 */
export interface BulkOperationResponse<T = any> {
  data: T[]
  meta: {
    total: number
    successful: number
    failed: number
    errors?: Array<{
      index: number
      id?: string | number
      error: string
    }>
  }
}

/**
 * Aggregation function type
 */
export type AggregationFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'

/**
 * Aggregation query configuration
 */
export interface AggregationQuery {
  /**
   * Aggregation functions to apply
   * Format: { function: field } or { count: '*' }
   */
  aggregates: Array<{
    function: AggregationFunction
    field?: string // optional for count
    alias?: string
  }>

  /**
   * Fields to group by
   */
  groupBy?: string[]

  /**
   * Having clause for group filtering
   */
  having?: Record<string, any>

  /**
   * Filter to apply before aggregation
   */
  filter?: Record<string, any>
}

/**
 * Aggregation response
 */
export interface AggregationResponse {
  data: Array<{
    group?: Record<string, any>
    [key: string]: any // aggregation results
  }>
  meta?: {
    total?: number
  }
}

/**
 * Hook service configuration
 */
export interface HookServiceConfig {
  /**
   * Global hooks registry (from plugins)
   */
  global?: Record<string, ResourceHooks>

  /**
   * Config-based hooks (from nuxt.config.ts)
   */
  config?: Record<string, ResourceHooks>

  /**
   * Per-resource hooks (from registry)
   */
  resource?: ResourceHooks
}

/**
 * Global hook registry (stored in globalThis)
 */
declare global {
  var __autoApiHooks: Record<string, ResourceHooks> | undefined
}

/**
 * Many-to-Many (M2M) configuration
 */
export interface M2MConfig {
  /**
   * Enable/disable automatic junction table detection
   * When disabled, only explicitly configured relations will work
   * @default true
   */
  autoDetect?: boolean

  /**
   * Explicitly configured M2M relations
   * Key: resource name (e.g., 'articles')
   * Value: Record of relation configs keyed by related resource name
   */
  relations?: Record<string, Record<string, M2MRelationConfig>>
}

/**
 * M2M relation configuration
 */
export interface M2MRelationConfig {
  /**
   * Junction table name (Drizzle schema export name)
   * @example 'articleCategories'
   */
  junctionTable: string

  /**
   * Foreign key column in junction table pointing to the source resource
   * @example 'articleId'
   */
  leftKey: string

  /**
   * Foreign key column in junction table pointing to the related resource
   * @example 'categoryId'
   */
  rightKey: string

  /**
   * Display label for the relation (used in admin UI)
   * @example 'Categories'
   */
  label?: string

  /**
   * Help text shown below the relation field in admin UI
   * @example 'Select categories for this article'
   */
  help?: string

  /**
   * Field to display in the dropdown/select (used in admin UI)
   * If not specified, tries common fields: 'name', 'title', 'label', 'email'
   * @example 'name'
   */
  displayField?: string

  /**
   * Optional metadata columns in the junction table
   * @example ['sortOrder', 'isPrimary']
   */
  metadataColumns?: string[]
}

/**
 * Export M2M types
 */
export * from './m2m'

/**
 * Export plugin types
 */
export * from './plugin'

/**
 * Export database types
 */
export * from './database'

/**
 * Export endpoint types
 */
export * from './endpoint'
