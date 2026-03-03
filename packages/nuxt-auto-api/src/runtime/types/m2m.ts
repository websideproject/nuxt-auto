import type { HandlerContext, AuthUser } from './index'

/**
 * M2M relationship configuration
 */
export interface M2MRelationConfig {
  /**
   * Target resource name
   */
  resource: string

  /**
   * Junction table name (auto-detected if not provided)
   */
  junctionTable?: string

  /**
   * Left key in junction table (auto-detected if not provided)
   */
  leftKey?: string

  /**
   * Right key in junction table (auto-detected if not provided)
   */
  rightKey?: string

  /**
   * Metadata columns in junction table (e.g., sortOrder, isPrimary)
   */
  metadataColumns?: string[]

  /**
   * Whether to validate metadata columns against schema
   * @default true
   */
  validateMetadata?: boolean
}

/**
 * M2M permission configuration
 */
export interface M2MPermissionConfig {
  /**
   * Resources that require update permission (not just read) on the related resource
   * Example: ['categories'] means linking categories requires update permission on categories
   */
  requireUpdateOnRelated?: string[]

  /**
   * Require update permission to link any relation (strict mode)
   * This prevents users from linking resources they can only read
   */
  requireUpdateToLink?: boolean

  /**
   * Custom permission checks per relation
   */
  relations?: Record<string, {
    /**
     * Custom permission check function for this relation
     * Return true to allow, false to deny, or throw error with message
     */
    check?: M2MPermissionFunction
  }>
}

/**
 * M2M permission check context
 */
export interface M2MPermissionContext {
  /**
   * Left side (main resource) information
   */
  left: {
    /**
     * Resource name (e.g., 'articles')
     */
    resource: string

    /**
     * Record ID
     */
    id: string | number

    /**
     * Full record (if fetched)
     */
    record?: any
  }

  /**
   * Right side (related resource) information
   */
  right: {
    /**
     * Resource name (e.g., 'categories')
     */
    resource: string

    /**
     * Related IDs being linked/unlinked
     */
    ids: Array<string | number>

    /**
     * Full records (if fetched)
     */
    records?: any[]
  }

  /**
   * Junction table information
   */
  junction: {
    /**
     * Junction table name
     */
    table: string

    /**
     * Left key column
     */
    leftKey: string

    /**
     * Right key column
     */
    rightKey: string

    /**
     * Metadata being set (if any)
     */
    metadata?: Record<string, any>[]
  }

  /**
   * Operation being performed
   */
  operation: 'list' | 'sync' | 'add' | 'remove'

  /**
   * Current authenticated user
   */
  user: AuthUser | null

  /**
   * User permissions
   */
  permissions: string[]

  /**
   * Full handler context
   */
  handlerContext: HandlerContext

  /**
   * Database instance
   */
  db: any

  /**
   * Schema instance
   */
  schema: any
}

/**
 * M2M permission check function
 */
export type M2MPermissionFunction = (
  context: M2MPermissionContext
) => boolean | Promise<boolean>

/**
 * M2M list request query parameters
 */
export interface M2MListQuery {
  /**
   * Whether to include full records (not just IDs)
   */
  includeRecords?: boolean | string

  /**
   * Fields to select from related records
   */
  fields?: string | string[]

  /**
   * Filter related records
   */
  filter?: Record<string, any>

  /**
   * Sort related records
   */
  sort?: string | string[]

  /**
   * Limit number of related records
   */
  limit?: number

  /**
   * Offset for related records
   */
  offset?: number

  /**
   * Include metadata columns from junction table
   */
  includeMetadata?: boolean | string
}

/**
 * M2M list response
 */
export interface M2MListResponse<T = any> {
  /**
   * IDs of related records
   */
  ids: Array<string | number>

  /**
   * Full records (if includeRecords=true)
   */
  records?: T[]

  /**
   * Junction metadata (if includeMetadata=true)
   */
  metadata?: Array<Record<string, any>>

  /**
   * Total count of relations
   */
  total: number

  /**
   * Meta information
   */
  meta?: {
    limit?: number
    offset?: number
    hasMore?: boolean
  }
}

/**
 * M2M sync request body
 */
export interface M2MSyncRequest {
  /**
   * IDs to sync (replace all existing relations)
   */
  ids: Array<string | number>

  /**
   * Metadata for each relation (must match ids length)
   */
  metadata?: Array<Record<string, any>>

  /**
   * Whether to replace all relations (true) or add to existing (false)
   * @default true
   */
  replace?: boolean
}

/**
 * M2M add request body
 */
export interface M2MAddRequest {
  /**
   * IDs to add
   */
  ids: Array<string | number>

  /**
   * Metadata for each new relation (must match ids length)
   */
  metadata?: Array<Record<string, any>>
}

/**
 * M2M remove request body
 */
export interface M2MRemoveRequest {
  /**
   * IDs to remove
   */
  ids: Array<string | number>
}

/**
 * M2M operation response
 */
export interface M2MOperationResponse {
  /**
   * Success status
   */
  success: boolean

  /**
   * Number of relations added
   */
  added?: number

  /**
   * Number of relations removed
   */
  removed?: number

  /**
   * Total number of relations after operation
   */
  total: number

  /**
   * Error message (if failed)
   */
  error?: string
}

/**
 * M2M batch sync request body
 */
export interface M2MBatchSyncRequest {
  /**
   * Relations to sync
   * Key: relation name
   * Value: sync request
   */
  relations: Record<string, {
    ids: Array<string | number>
    metadata?: Array<Record<string, any>>
  }>
}

/**
 * M2M batch sync response
 */
export interface M2MBatchSyncResponse {
  /**
   * Success status
   */
  success: boolean

  /**
   * Results per relation
   */
  results: Record<string, {
    added: number
    removed: number
    total: number
    error?: string
  }>

  /**
   * Overall error (if completely failed)
   */
  error?: string
}

/**
 * Detected junction table information
 */
export interface DetectedJunction {
  /**
   * Junction table name
   */
  tableName: string

  /**
   * Left resource name
   */
  leftResource: string

  /**
   * Right resource name
   */
  rightResource: string

  /**
   * Left key column in junction table
   */
  leftKey: string

  /**
   * Right key column in junction table
   */
  rightKey: string

  /**
   * Additional metadata columns
   */
  metadataColumns: string[]

  /**
   * Drizzle table object
   */
  table: any
}

/**
 * M2M validation result
 */
export interface M2MValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean

  /**
   * Error message (if validation failed)
   */
  error?: string

  /**
   * Validated data (if valid)
   */
  data?: {
    ids: Array<string | number>
    metadata?: Array<Record<string, any>>
  }
}

/**
 * M2M batch operation input
 */
export interface M2MBatchOperation {
  /**
   * IDs to add
   */
  toAdd: Array<string | number>

  /**
   * IDs to remove
   */
  toRemove: Array<string | number>

  /**
   * Metadata for added items (must match toAdd length)
   */
  metadata?: Array<Record<string, any>>
}

/**
 * M2M batch operation result
 */
export interface M2MBatchResult {
  /**
   * Number of items added
   */
  added: number

  /**
   * Number of items removed
   */
  removed: number

  /**
   * Total count after operation
   */
  total: number
}
