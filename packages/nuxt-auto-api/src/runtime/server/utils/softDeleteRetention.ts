import { and, count, isNotNull, lt } from 'drizzle-orm'
import { getDatabaseAdapter } from '../database'
import { getSoftDeleteColumn } from './softDelete'
import { mergeAuthConfig } from './authConfig'

export interface PurgeExpiredTrashResult {
  /** Rows hard-deleted, per resource (resources with nothing expired are left out). */
  purged: Record<string, number>
  total: number
  /** Resources whose purge failed (e.g. a foreign key still references a trashed row), with the message. */
  errors: Record<string, string>
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Hard-delete trashed rows older than each resource's `softDelete.retentionDays` (from the resource's
 * authorization, or its `autoApi.authorization` override in nuxt.config). Resources without a retention, or
 * with `0`, keep their trash forever.
 *
 * A system operation: it runs across every tenant, without permissions or hooks, like any raw Drizzle write.
 * The built-in `auto-api:purge-trash` task calls it; call it yourself from your own task when the database is
 * created per request (Cloudflare D1): `purgeExpiredTrash({ db: drizzle(env.DB, { schema }) })`.
 */
export async function purgeExpiredTrash(options: { db?: any, runtimeConfig?: any, now?: Date } = {}): Promise<PurgeExpiredTrashResult> {
  const { registry } = await import('#nuxt-auto-api-registry') as any
  const db = options.db ?? getDatabaseAdapter().db
  const now = (options.now ?? new Date()).getTime()
  const overrides = options.runtimeConfig?.autoApi?.authorization ?? {}

  const result: PurgeExpiredTrashResult = { purged: {}, total: 0, errors: {} }
  for (const [resource, config] of Object.entries(registry as Record<string, any>)) {
    const days = Number(mergeAuthConfig(config.authorization, overrides[resource])?.softDelete?.retentionDays ?? 0)
    const table = config.schema
    const marker = getSoftDeleteColumn(table)
    if (!(days > 0) || !marker) continue

    const expired = and(isNotNull(table[marker]), lt(table[marker], new Date(now - days * DAY_MS)))
    try {
      const [row] = await db.select({ n: count() }).from(table).where(expired)
      const n = Number(row?.n ?? 0)
      if (n === 0) continue
      await db.delete(table).where(expired)
      result.purged[resource] = n
      result.total += n
    }
    catch (error: any) {
      result.errors[resource] = String(error?.cause?.message ?? error?.message ?? error)
    }
  }
  return result
}
