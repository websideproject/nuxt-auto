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
   * Not read by the module — the engine is the second argument of `initializeDatabase(db, engine)` in your
   * server plugin. Kept so existing configs still type-check.
   * @deprecated
   */
  database?: {
    client?: DatabaseEngine
  }

  /**
   * Authorization configuration per resource
   */
  authorization?: Record<string, ResourceAuthConfig>

  /**
   * Pagination configuration
   */
  pagination?: {
    /** Page size when `?limit` is absent. @default 20 */
    defaultLimit?: number
    /** Largest accepted `?limit` (also caps relation and M2M pages). @default 100 */
    maxLimit?: number
  }

  /**
   * Multi-tenancy configuration
   */
  multiTenancy?: MultiTenancyConfig

  /**
   * Plugins for extending the auto-api — a server file, plugins listed here, or both:
   *
   * ```ts
   * plugins: ['~/server/autoapi-plugins', createExportPlugin({ formats: ['csv'] })]
   * ```
   *
   * - **A file** (default-exports an array of plugins): anything goes — imports, instances (a KV store),
   *   closures. It runs on the server only, so plugins that add ROUTES do not work from it.
   * - **Listed here**: plugins that add routes (export, file upload, audit-log / activity feeds, token
   *   introspection) must be. A built-in factory is recreated on the server from its options, so they must be
   *   data or self-contained functions; an instance fails the build with a pointer to the file.
   */
  plugins?: string | Array<AutoApiPlugin | string>

  /**
   * Nested relations configuration
   */
  relations?: {
    maxDepth?: number // default: 3
    maxIncludes?: number // default: 20 — relations per request
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
   * Log registration and plugin details at build time. @default false
   */
  debug?: boolean

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
   * Enable multi-tenancy. Tenant-scoped resources then only ever expose rows of the caller's tenant, and a
   * request without an active tenant is refused (fails closed).
   */
  enabled: boolean

  /**
   * Column (property key) holding the tenant id on scoped tables.
   * @default 'organizationId'
   */
  tenantIdField?: string

  /**
   * Property of `ctx.user` that holds the caller's active tenant id.
   * @default the value of `tenantIdField`
   */
  userTenantField?: string

  /**
   * Resources to scope. `'*'` scopes every resource whose table has the tenant column.
   * @default '*'
   */
  scopedResources?: string[] | '*'

  /**
   * Resources never scoped (e.g. a global lookup table that happens to have the column).
   */
  excludedResources?: string[]
}

export interface ResourceAuthConfig {
  /**
   * Who may perform each operation. **Deny by default**: an operation with no entry is refused.
   *
   *  - `true` / `false` — everyone / no one (`false` beats even the `*` permission)
   *  - `'perm'` / `['a', 'b']` — callers holding that permission / any of them
   *  - `(ctx) => boolean` — a function decides
   *  - `{ ... }` — a descriptor evaluated by a registered permission evaluator
   */
  permissions?: {
    read?: PermissionValue
    create?: PermissionValue
    update?: PermissionValue
    delete?: PermissionValue

    /**
     * Run aggregations (`/aggregate`, `?aggregate=`). Falls back to `read` when unset.
     */
    aggregate?: PermissionValue

    /**
     * Restore a soft-deleted row (POST /:id/restore + batch restore).
     * Falls back to `softDelete.restore` → `update` when unset.
     */
    restore?: PermissionValue
    /**
     * Permanently purge a soft-deleted row (DELETE ?force=true + batch purge).
     * Falls back to `softDelete.purge` → `delete` when unset.
     */
    purge?: PermissionValue
    /**
     * See soft-deleted rows in list/get/aggregate (`?includeDeleted` / `?onlyDeleted`).
     * Falls back to `softDelete.viewDeleted` → the restore permission when unset.
     */
    viewDeleted?: PermissionValue

    /**
     * M2M relationship permissions
     */
    m2m?: M2MPermissionConfig
  }

  /**
   * Soft-delete behaviour for this resource. Permission keys here are an alternative home for
   * restore/purge/viewDeleted (kept beside the other soft-delete knobs); `permissions.restore`
   * etc. take precedence when both are set.
   */
  softDelete?: {
    restore?: PermissionValue
    purge?: PermissionValue
    viewDeleted?: PermissionValue
    /** Cascade soft-delete to FK children. `'auto'` (default) mirrors each FK's onDelete; `'off'` disables. */
    cascade?: 'auto' | 'off'
    /** Trash retention before the purge task hard-deletes (days; 0 = never). */
    retentionDays?: number
  }

  /**
   * Object-level authorization function.
   * Applied per-item on get/update/delete, and as a post-filter on list.
   * For list operations, prefer `listFilter` for better performance and correct pagination.
   */
  objectLevel?: ObjectLevelAuthFunction

  /**
   * Row visibility as a SQL condition: which rows of this resource the caller may see. Despite the name it
   * scopes EVERY access — list, get, update, delete, restore, bulk, aggregate, M2M and `?include=` — so a row
   * a caller cannot list is also a row they cannot fetch, change or delete by id.
   * Receives the Drizzle table and handler context, returns a SQL condition or undefined (no restriction).
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
      read?: PermissionValue
      write?: PermissionValue
    }
  }

  /**
   * Per-named-endpoint permissions for custom endpoints created with createEndpoint().
   * The module defines defaults here; apps can override individual keys from nuxt.config
   * using string/array values (e.g. `'admin'`). Function values only work from build-time imports.
   *
   * @example
   * ```ts
   * // In auth.ts (module default — can use functions)
   * custom: {
   *   secretRotate: { permissions: { update: (ctx) => !!ctx.user } }
   * }
   *
   * // In nuxt.config.ts (app override — strings only)
   * autoApi: {
   *   authorization: {
   *     webhooks: { custom: { secretRotate: { permissions: { update: 'admin' } } } }
   *   }
   * }
   * ```
   */
  custom?: Record<string, {
    permissions?: {
      read?: PermissionValue
      create?: PermissionValue
      update?: PermissionValue
      delete?: PermissionValue
    }
  }>
}

export type PermissionFunction = (context: HandlerContext) => boolean | Promise<boolean>

/**
 * A permission declaration: `true`/`false`, a permission string, any-of array, function, or descriptor object.
 */
export type PermissionValue = boolean | string | string[] | PermissionFunction | PermissionObject

/**
 * Structured ("object") permission value — opaque to auto-api. Evaluated by externally
 * registered `PermissionEvaluator`s (see `registerPermissionEvaluator`). This is the generic
 * seam for custom permission kinds (e.g. plan/role policy descriptors) — the framework never
 * inspects the object's shape; a consumer registers an evaluator that understands it.
 */
export type PermissionObject = Record<string, unknown>

/**
 * Evaluates a structured (object) permission value against the request context.
 * Return a boolean to decide; return `undefined` to defer to the next registered evaluator
 * (i.e. "this object isn't mine"). If no evaluator handles it, the framework denies (closed).
 */
export type PermissionEvaluator = (
  value: PermissionObject,
  context: HandlerContext,
) => boolean | undefined | Promise<boolean | undefined>

export type ObjectLevelAuthFunction = (
  object: any,
  context: HandlerContext,
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
   * The resolved Nuxt/Nitro runtime config, captured once in the bundled context-builder. Registry-
   * loaded auth config files (auth.ts) are NOT auto-import-transformed, so they must read config from
   * here — `ctx.runtimeConfig` — rather than a bare `useRuntimeConfig()` (mirrors the plugin context).
   */
  runtimeConfig?: any

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
    /** Column (property key) that holds the tenant id. */
    field: string
    /** Set by a context extender for cross-tenant operators: tenant scoping is not applied. */
    canAccessAllTenants: boolean
  }

  /**
   * Resource configuration from registry
   */
  resourceConfig?: ResourceRegistration

  /**
   * The resource's authorization config AFTER the nuxt.config override has been merged in.
   *
   * `resourceConfig.authorization` is the module's build-time declaration alone, so anything reading it
   * directly ignores an app-level override. Field-level read/write enforcement uses this.
   */
  effectiveAuth?: ResourceAuthConfig

  /**
   * Full resource registry (for accessing all resource configs)
   */
  registry?: Record<string, ResourceRegistration>

  /**
   * Set on `/bulk` routes: the body is `{ items }` / `{ ids }` and every item is validated on its own.
   */
  bulk?: boolean

  /**
   * Short-circuit the handler pipeline.
   * When set by middleware (e.g., cache plugin in pre-execute),
   * the entry handler skips the main handler and returns this data directly.
   */
  shortCircuit?: { data: any, status?: number }

  /** The handler's response, set before `post-execute` middleware runs (not on a short-circuited request). */
  result?: unknown

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
    [key: string]: any // Allow custom fields from user-defined extractors
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
  /** May return the (transformed) results; returning nothing keeps them. */
  afterList?: (results: any[], context: HandlerContext) => unknown
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
  authorization?: ResourceAuthConfig | any // Auth config or path info at build time
  validation?: ValidationSchema | any // Validation schema or path info at build time
  hooks?: ResourceHooks
  metadata?: Record<string, any>
  hiddenFields?: string[] // Fields to hide from API responses
  /**
   * Extra columns request bodies may never set (on top of the primary key, tenant, soft-delete and audit
   * columns, which are always protected). Hooks can still write them.
   */
  protectedFields?: string[]
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

  /** Whether the user can restore soft-deleted rows */
  canRestore?: boolean

  /** Whether the user can permanently purge rows */
  canPurge?: boolean

  /** Whether the user can see soft-deleted rows (`?includeDeleted` / `?onlyDeleted`) */
  canViewDeleted?: boolean

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
/** What the caller may do on one row (see `GET /api/{resource}/permissions?ids=`). */
export interface RecordPermissions {
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface PermissionQueryResponse extends PermissionCheckResult {
  resource: string
  user: AuthUser | null
  /** Per-row answers, keyed by id as requested — only with `?ids=`. */
  records?: Record<string, RecordPermissions>
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
