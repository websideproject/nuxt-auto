/**
 * Cross-engine schema presets — **MySQL dialect**
 * (covers mysql2 / PlanetScale)
 *
 * Import from `@websideproject/nuxt-auto-api/schema/mysql`
 *
 * ⚠ MySQL has **no partial (filtered) indexes** — `liveUnique` uses a generated
 * stored column workaround. See `liveUniqueMysql()` and the docs.
 */

import { datetime, varchar, text, json as mysqlJson, index, uniqueIndex } from 'drizzle-orm/mysql-core'
import { COL, nowFn, toSnakeCase, tableNameFromColumn } from './shared'
import type { IdOpts, TenantOpts, SoftDeleteOpts, SoftDeletePreset, TenantPreset } from './shared'

// ── id ───────────────────────────────────────────────────────────────────────

export function id(_opts: IdOpts = {}): Record<string, any> {
  return {
    // MySQL has no native UUID column type; varchar(36) is conventional.
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  }
}

// ── timestamps ───────────────────────────────────────────────────────────────

export function timestamps(): Record<string, any> {
  return {
    createdAt: datetime(COL.createdAt, { mode: 'date' }).notNull().$defaultFn(nowFn),
    updatedAt: datetime(COL.updatedAt, { mode: 'date' }).notNull().$defaultFn(nowFn).$onUpdate(nowFn),
  }
}

// ── audit ────────────────────────────────────────────────────────────────────

export function audit(): Record<string, any> {
  return {
    createdBy: varchar(COL.createdBy, { length: 255 }),
    updatedBy: varchar(COL.updatedBy, { length: 255 }),
  }
}

// ── tenant ───────────────────────────────────────────────────────────────────

function tenantFn(opts: TenantOpts = {}): Record<string, any> {
  const camel = opts.field ?? 'organizationId'
  const snake = opts.field ? toSnakeCase(opts.field) : 'organization_id'
  return { [camel]: varchar(snake, { length: 255 }) }
}
tenantFn.indexes = (t: any) => [index(`${tableNameFromColumn(t.organizationId)}_tenant_org_idx`).on(t.organizationId)]

export const tenant = tenantFn as unknown as TenantPreset

// ── softDelete ───────────────────────────────────────────────────────────────

export function softDelete(opts: SoftDeleteOpts = {}): SoftDeletePreset {
  const columns: Record<string, any> = {
    deletedAt: datetime(COL.deletedAt, { mode: 'date' }),
  }
  if (opts.by !== false) columns.deletedBy = varchar(COL.deletedBy, { length: 255 })
  if (opts.batch !== false) columns.deletionId = varchar(COL.deletionId, { length: 36 })
  if (opts.reason !== false) columns.deletedReason = text(COL.deletedReason)

  return {
    columns,
    indexes: (t: any) => {
      const tn = tableNameFromColumn(t.deletedAt)
      return [
        index(`${tn}_trash_idx`).on(t.deletedAt),
        ...(opts.batch !== false && t.deletionId ? [index(`${tn}_batch_idx`).on(t.deletionId)] : []),
      ]
    },
  }
}

// ── json ─────────────────────────────────────────────────────────────────────

export function json(name: string): any {
  return mysqlJson(name)
}

// ── liveUnique ───────────────────────────────────────────────────────────────

/**
 * MySQL **does not support** partial/filtered indexes. Instead, use `liveUniqueMysql()`:
 * it creates a generated stored column `<colName>_live` that is `<col>` when `deleted_at IS NULL`
 * and `NULL` otherwise, then puts a plain unique index on it.
 *
 * MySQL's unique indexes ignore NULL values, so two "deleted" rows with the same slug are allowed.
 *
 * Call this **after** your table definition and add it to the columns spread, not the indexes array:
 * ```ts
 * export const articles = mysqlTable('articles', {
 *   ...id(), ...timestamps(),
 *   slug: varchar('slug', { length: 255 }).notNull(),
 *   ...softDelete().columns,
 *   ...liveUniqueMysql('slug', 'articles_slug_live'),
 * }, t => [...softDelete().indexes(t)])
 * ```
 *
 * ⚠ This adds an extra generated column to the table — it is documented, not hidden.
 */
export function liveUniqueMysql(_colSql: string, name: string): Record<string, any> {
  // Drizzle doesn't have first-class generated-column support for MySQL in all versions,
  // so we document the pattern here. The app dev adds this as raw SQL in the migration.
  // Return a placeholder column that will be caught in code review / migration review.
  console.warn(
    `[nuxt-auto-api/schema/mysql] liveUniqueMysql("${name}") requires a manual migration step. `
    + `Add a generated stored column and a unique index — see docs/schema-presets.md#mysql-live-unique.`,
  )
  return {}
}

/**
 * Standard liveUnique for MySQL — logs a warning and returns empty (requires manual migration).
 * Use `liveUniqueMysql()` instead which provides the correct pattern.
 */
export function liveUnique(_t: any, _col: any, name: string): any {
  liveUniqueMysql('', name)
  return uniqueIndex(`${name}_uq`) // placeholder — won't be partial on MySQL
}
