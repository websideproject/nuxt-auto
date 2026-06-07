// Dialect-agnostic constants and types shared by all per-dialect preset modules.

import { getTableName } from 'drizzle-orm'

/** Canonical DB column names (snake_case) — must match auto-api's detection by name. */
export const COL = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  createdBy: 'created_by',
  updatedBy: 'updated_by',
  deletedAt: 'deleted_at',
  deletedBy: 'deleted_by',
  deletionId: 'deletion_id',
  deletedReason: 'deleted_reason',
} as const

/** Factory function that returns the current date. Used by $defaultFn / $onUpdate. */
export const nowFn = (): Date => new Date()

/** Options for the `id()` preset. */
export interface IdOpts {
  /** @default 'uuid' */
  mode?: 'uuid' | 'serial'
}

/** Options for the `tenant()` preset. */
export interface TenantOpts {
  /** Column camelCase name and snake_case DB name. @default 'organizationId' / 'organization_id' */
  field?: string
}

/** Options for the `softDelete()` preset. */
export interface SoftDeleteOpts {
  /** Include `deletedBy` (userId who trashed). @default true */
  by?: boolean
  /** Include `deletionId` (batch restore/purge hash). @default true */
  batch?: boolean
  /** Include `deletedReason`. @default true */
  reason?: boolean
}

/** Return type of the `softDelete()` preset — columns spread + index factory. */
export interface SoftDeletePreset {
  columns: Record<string, any>
  indexes: (t: any) => any[]
}

/** Return type of the `tenant()` preset (has both columns and index factory). */
export interface TenantPreset {
  (opts?: TenantOpts): Record<string, any>
  indexes: (t: any) => any[]
}

/** Convert a camelCase field name to snake_case for the DB column. */
export function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * Resolve the owning table's SQL name from any built column, inside a table
 * extra-config callback. Used to namespace preset index names per table so they
 * don't collide globally (SQLite/Postgres require globally-unique index names).
 */
export function tableNameFromColumn(col: any): string {
  return getTableName(col.table)
}
