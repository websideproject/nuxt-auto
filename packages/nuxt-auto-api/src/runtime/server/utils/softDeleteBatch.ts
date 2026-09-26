import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { createError } from 'h3'
import { getSoftDeleteColumn, buildRestoreUpdates } from './softDelete'
import { assertResourcePermission } from './permissions'
import { recordRevisionIfPresent } from './revisionRecord'
import { passesObjectLevel, rowScope } from './rowAccess'
import { hasColumn, primaryKeyName } from './table'

/**
 * Batch restore / purge: every trashed row that shares one `deletionId` (a cascade soft delete stamps the
 * parent and all its children with the same id) comes back — or goes — as a unit.
 *
 * All-or-nothing on authorization: every row of the batch must be visible to the caller (tenant,
 * listFilter, objectLevel) and pass the resource's restore / purge permission. If any row does not, NOTHING
 * is changed and the call is a 403 — a batch is never half-restored, and a caller can never pull another
 * tenant's rows back by naming (or grafting onto) their batch. `deletionId` is always server-generated.
 */

export interface BatchResult {
  counts: Record<string, number>
  total: number
}

interface BatchGroup {
  resource: string
  table: any
  deletionCol: string
  rows: any[]
}

async function findBatch(context: any, deletionId: string): Promise<BatchGroup[]> {
  const out: BatchGroup[] = []
  for (const [resource, table] of Object.entries<any>(context.schema ?? {})) {
    const softCol = getSoftDeleteColumn(table)
    if (!softCol) continue
    const deletionCol = hasColumn(table, 'deletionId') ? 'deletionId' : hasColumn(table, 'deletion_id') ? 'deletion_id' : null
    if (!deletionCol) continue
    const rows = await context.db.select().from(table)
      .where(and(eq(table[deletionCol], deletionId), isNotNull(table[softCol])))
    if (rows.length > 0) out.push({ resource, table, deletionCol, rows })
  }
  return out
}

async function assertBatchAuthorized(context: any, groups: BatchGroup[], operation: 'restore' | 'purge'): Promise<void> {
  for (const { resource, table, rows } of groups) {
    await assertResourcePermission(resource, operation, context)
    const pk = primaryKeyName(table)
    const scope = rowScope(context, resource, table, { softDeleted: 'only' })
    let visible = rows
    if (scope) {
      const found = await context.db.select().from(table).where(and(scope, inArray(table[pk], rows.map(r => r[pk]))))
      const ids = new Set(found.map((r: any) => String(r[pk])))
      visible = rows.filter(r => ids.has(String(r[pk])))
    }
    if (visible.length !== rows.length) {
      throw createError({ statusCode: 403, message: `Forbidden: the batch contains ${resource} rows you cannot ${operation}` })
    }
    for (const row of rows) {
      if (!(await passesObjectLevel(context, resource, row))) {
        throw createError({ statusCode: 403, message: `Forbidden: the batch contains ${resource} rows you cannot ${operation}` })
      }
    }
  }
}

export async function restoreSoftDeletedBatch(context: any, deletionId: string): Promise<BatchResult> {
  const groups = await findBatch(context, deletionId)
  await assertBatchAuthorized(context, groups, 'restore')

  const counts: Record<string, number> = {}
  let total = 0
  for (const { resource, table, deletionCol, rows } of groups) {
    await context.db.update(table).set(buildRestoreUpdates(table)).where(eq(table[deletionCol], deletionId))
    counts[resource] = rows.length
    total += rows.length
    const softCol = getSoftDeleteColumn(table)!
    for (const row of rows) {
      await recordRevisionIfPresent(context, resource, row[primaryKeyName(table)], 'restore', { ...row, [softCol]: null })
    }
  }
  return { counts, total }
}

export async function purgeSoftDeletedBatch(context: any, deletionId: string): Promise<BatchResult> {
  const groups = await findBatch(context, deletionId)
  await assertBatchAuthorized(context, groups, 'purge')

  const counts: Record<string, number> = {}
  let total = 0
  for (const { resource, table, deletionCol, rows } of groups) {
    await context.db.delete(table).where(eq(table[deletionCol], deletionId))
    counts[resource] = rows.length
    total += rows.length
  }
  return { counts, total }
}
