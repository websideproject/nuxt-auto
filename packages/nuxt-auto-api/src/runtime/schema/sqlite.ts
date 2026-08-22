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
 * Accepts one column or several — `liveUnique(t, [t.orgId, t.slug], 'x')` for a composite.
 *
 * **Why it validates rather than trusting its argument.** This used to take a single column and simply
 * forward it to `.on()`. Passing an array (a composite index, the obvious thing to try) or a mistyped
 * column name (`t.slugg` → `undefined`) both produced `ON "table" ()` — syntactically invalid SQL that
 * nothing complains about until `drizzle-kit` generates a migration and D1 rejects it, by which point the
 * cause is several files away from the error. It shipped a broken index twice that way. Failing here, at
 * schema-definition time, puts the error next to the mistake.
 *
 * @param t - the table object (second arg to sqliteTable)
 * @param col - the column, or array of columns, to make unique (e.g. t.slug)
 * @param name - index name prefix (must be unique per table)
 */
export function liveUnique(t: any, col: any, name: string): any {
  const cols = Array.isArray(col) ? col : [col]
  if (!cols.length || cols.some(c => c == null)) {
    throw new Error(
      `liveUnique("${name}"): expected a column or a non-empty array of columns, got `
      + `${Array.isArray(col) ? `an array of ${cols.length} with ${cols.filter(c => c == null).length} empty slot(s)` : String(col)}. `
      + `A missing column here emits \`ON table ()\`, which only fails at migration time.`,
    )
  }
  return uniqueIndex(`${name}_uq`).on(...cols).where(sql`${t.deletedAt} is null`)
}
