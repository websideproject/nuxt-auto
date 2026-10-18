/**
 * Cross-engine schema presets — **MySQL dialect**
 * (covers mysql2 / PlanetScale)
 *
 * Import from `@websideproject/nuxt-auto-api/schema/mysql`
 *
 * ⚠ MySQL has **no partial (filtered) indexes** — `liveUnique` indexes a generated
 * stored column from `liveUniqueMysql()`. See the docs.
 */

import { datetime, varchar, int, text, json as mysqlJson, index, uniqueIndex } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { COL, nowFn, toSnakeCase, tableNameFromColumn, tenantColumn, tenantIndexName } from './shared'
import type { IdOpts, TenantOpts, SoftDeleteOpts, SoftDeletePreset, TenantPreset } from './shared'

// ── id ───────────────────────────────────────────────────────────────────────

export function id(opts: IdOpts = {}): Record<string, any> {
  // `int auto_increment` rather than MySQL's `serial` (bigint unsigned), so plain `int` foreign keys can reference it.
  if (opts.mode === 'serial') return { id: int('id').autoincrement().primaryKey() }
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
tenantFn.indexes = (t: any, opts: TenantOpts = {}) => {
  const column = tenantColumn(t, opts)
  return [index(tenantIndexName(column, opts)).on(column)]
}

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

type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}` ? `${Head}${Capitalize<CamelCase<Tail>>}` : S

/** Options for `liveUniqueMysql()`. */
export interface LiveUniqueMysqlOpts {
  /** varchar length of the generated column. @default 255 */
  length?: number
}

/**
 * MySQL has no partial (filtered) indexes, so "unique among live rows" takes a **generated stored column**:
 * `<col>_live` holds `<col>` while `deleted_at IS NULL` and `NULL` once the row is trashed. MySQL unique indexes
 * ignore NULLs, so trashed rows never collide; `liveUnique()` puts the index on it.
 *
 * Spread it into the columns (the property is `<column>Live`, camelCased), then index it:
 * ```ts
 * export const articles = mysqlTable('articles', {
 *   ...id(), ...timestamps(),
 *   slug: varchar('slug', { length: 255 }).notNull(),
 *   ...softDelete().columns,
 *   ...liveUniqueMysql('slug'),                          // slugLive → slug_live
 * }, t => [liveUnique(t, t.slugLive, 'articles_slug_live')])
 * ```
 * For a composite, index the live column with the others: `liveUnique(t, [t.organizationId, t.slugLive], …)`.
 *
 * @param column - the SQL name of the column to keep unique among live rows (e.g. `'slug'`)
 */
export function liveUniqueMysql<C extends string>(column: C, opts: LiveUniqueMysqlOpts | string = {}): Record<`${CamelCase<C>}Live`, any> {
  if (!/^\w+$/.test(column)) throw new Error(`liveUniqueMysql("${column}"): expected the column's SQL name`)
  const length = typeof opts === 'string' ? 255 : opts.length ?? 255
  const key = `${column.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}Live`
  return {
    [key]: varchar(`${column}_live`, { length }).generatedAlwaysAs(
      sql.raw(`(case when \`${COL.deletedAt}\` is null then \`${column}\` end)`),
      { mode: 'stored' },
    ),
  } as Record<`${CamelCase<C>}Live`, any>
}

/**
 * Unique index among live (non-deleted) rows. On MySQL the index must include the generated column from
 * `liveUniqueMysql()` (`t.slugLive`) — a plain column would make trashed rows collide too, so it is refused.
 *
 * @param _t - the table object (second arg to mysqlTable; unused — same signature as the other dialects)
 * @param col - the generated live column, or an array of columns that includes it
 * @param name - index name prefix (must be unique per table)
 */
export function liveUnique(_t: any, col: any, name: string): any {
  const cols = Array.isArray(col) ? col : [col]
  if (!cols.length || cols.some(c => c == null)) {
    throw new Error(`liveUnique("${name}"): expected a column or a non-empty array of columns.`)
  }
  if (!cols.some(c => c.generated)) {
    throw new Error(
      `liveUnique("${name}"): MySQL has no partial indexes — add the generated column with liveUniqueMysql('<column>') `
      + `and index it: liveUnique(t, t.<column>Live, '${name}').`,
    )
  }
  return uniqueIndex(`${name}_uq`).on(...(cols as [any, ...any[]]))
}
