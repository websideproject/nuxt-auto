/**
 * Cross-engine schema presets — **SQLite dialect**
 * (covers better-sqlite3 / D1 / Turso)
 *
 * Import from `@websideproject/nuxt-auto-api/schema/sqlite`
 *
 * @example
 * ```ts
 * import { sqliteTable } from 'drizzle-orm/sqlite-core'
 * import { id, timestamps, tenant, softDelete, audit, liveUnique, json } from '@websideproject/nuxt-auto-api/schema/sqlite'
 *
 * const sd = softDelete()
 * export const articles = sqliteTable('articles', {
 *   ...id(),
 *   title: text('title').notNull(),
 *   ...tenant(),
 *   ...timestamps(),
 *   ...audit(),
 *   ...sd.columns,
 * }, t => [
 *   ...sd.indexes(t),
 *   ...tenant.indexes(t),
 *   liveUnique(t, t.slug, 'articles_slug_live'),
 * ])
 * ```
 */

import { integer, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { COL, nowFn, toSnakeCase, tableNameFromColumn } from './shared'
import type { IdOpts, TenantOpts, SoftDeleteOpts, SoftDeletePreset, TenantPreset } from './shared'

// ── id ───────────────────────────────────────────────────────────────────────

export function id(_opts: IdOpts = {}): Record<string, any> {
  return {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  }
}

// ── timestamps ───────────────────────────────────────────────────────────────

export function timestamps(): Record<string, any> {
  return {
    createdAt: integer(COL.createdAt, { mode: 'timestamp' }).notNull().$defaultFn(nowFn),
    updatedAt: integer(COL.updatedAt, { mode: 'timestamp' }).notNull().$defaultFn(nowFn).$onUpdate(nowFn),
  }
}

// ── audit (createdBy / updatedBy — filled by the audit-stamp plugin) ─────────

export function audit(): Record<string, any> {
  return {
    createdBy: text(COL.createdBy),
    updatedBy: text(COL.updatedBy),
  }
}

// ── tenant ───────────────────────────────────────────────────────────────────

function tenantFn(opts: TenantOpts = {}): Record<string, any> {
  const camel = opts.field ?? 'organizationId'
  const snake = opts.field ? toSnakeCase(opts.field) : 'organization_id'
  return { [camel]: text(snake) }
}
tenantFn.indexes = (t: any) => [index(`${tableNameFromColumn(t.organizationId)}_tenant_org_idx`).on(t.organizationId)]

export const tenant = tenantFn as unknown as TenantPreset

// ── softDelete ───────────────────────────────────────────────────────────────

export function softDelete(opts: SoftDeleteOpts = {}): SoftDeletePreset {
  const columns: Record<string, any> = {
    deletedAt: integer(COL.deletedAt, { mode: 'timestamp' }),
  }
  if (opts.by !== false) columns.deletedBy = text(COL.deletedBy)
  if (opts.batch !== false) columns.deletionId = text(COL.deletionId)
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
  return text(name, { mode: 'json' })
}

// ── liveUnique (partial unique index among live rows only) ────────────────────

/**
 * Creates a partial unique index that only applies to non-deleted (live) rows.
 * SQLite/D1 supports WHERE clauses on indexes natively.
 *
 * @param t - the table object (second arg to sqliteTable)
 * @param col - the column to make unique (e.g. t.slug)
 * @param name - index name prefix (must be unique per table)
 */
export function liveUnique(t: any, col: any, name: string): any {
  return uniqueIndex(`${name}_uq`).on(col).where(sql`${t.deletedAt} is null`)
}
