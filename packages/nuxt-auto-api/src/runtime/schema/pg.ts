/**
 * Cross-engine schema presets — **Postgres dialect**
 *
 * Import from `@websideproject/nuxt-auto-api/schema/pg`
 */

import { timestamp, text, uuid, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { COL, nowFn, toSnakeCase, tableNameFromColumn } from './shared'
import type { IdOpts, TenantOpts, SoftDeleteOpts, SoftDeletePreset, TenantPreset } from './shared'

// ── id ───────────────────────────────────────────────────────────────────────

export function id(_opts: IdOpts = {}): Record<string, any> {
  return {
    id: uuid('id').defaultRandom().primaryKey(),
  }
}

// ── timestamps ───────────────────────────────────────────────────────────────

export function timestamps(): Record<string, any> {
  return {
    createdAt: timestamp(COL.createdAt, { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp(COL.updatedAt, { withTimezone: true }).notNull().defaultNow().$onUpdate(nowFn),
  }
}

// ── audit ────────────────────────────────────────────────────────────────────

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
    deletedAt: timestamp(COL.deletedAt, { withTimezone: true }),
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
  return jsonb(name)
}

// ── liveUnique ───────────────────────────────────────────────────────────────

/**
 * Partial unique index among live (non-deleted) rows. Postgres supports WHERE.
 */
export function liveUnique(t: any, col: any, name: string): any {
  return uniqueIndex(`${name}_uq`).on(col).where(sql`${t.deletedAt} is null`)
}
