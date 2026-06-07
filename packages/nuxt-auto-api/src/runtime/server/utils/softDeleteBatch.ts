import { eq, and, isNotNull } from 'drizzle-orm'
import { getSoftDeleteColumn, buildRestoreUpdates } from './softDelete'
import { assertResourcePermission } from './permissions'
import { recordRevisionIfPresent } from './revisionRecord'

export interface BatchResult {
  /** resource → number of rows restored/purged */
  counts: Record<string, number>
  total: number
}

/**
 * Find every soft-deletable table that has a `deletion_id`/`deletionId` column and the trashed rows
 * in it matching `deletionId`. Used to act on a whole cascade batch across resources.
 */
async function findBatchRows(context: any, deletionId: string): Promise<Array<{ resource: string, table: any, softCol: string, deletionCol: string, rows: any[] }>> {
  const schema: Record<string, any> = context.schema ?? {}
  const out: Array<{ resource: string, table: any, softCol: string, deletionCol: string, rows: any[] }> = []
  for (const [resource, table] of Object.entries(schema)) {
    const softCol = getSoftDeleteColumn(table)
    if (!softCol) continue
    const cols = Object.keys(table as any)
    const deletionCol = cols.includes('deletionId') ? 'deletionId' : cols.includes('deletion_id') ? 'deletion_id' : null
    if (!deletionCol) continue
    const rows = await context.db.select().from(table)
      .where(and(eq((table as any)[deletionCol], deletionId), isNotNull((table as any)[softCol])))
    if (rows.length > 0) out.push({ resource, table, softCol, deletionCol, rows })
  }
  return out
}

/**
 * Restore every trashed row across all resources that shares `deletionId` (the cascade unit).
 * Authorizes per owning resource with the `restore` permission; records a `restore` revision per row.
 */
export async function restoreSoftDeletedBatch(context: any, deletionId: string): Promise<BatchResult> {
  const groups = await findBatchRows(context, deletionId)
  const counts: Record<string, number> = {}
  let total = 0
  for (const { resource, table, deletionCol, rows } of groups) {
    for (const row of rows) {
      await assertResourcePermission(resource, 'restore', context, { recordId: row.id })
    }
    await context.db.update(table)
      .set(buildRestoreUpdates(table))
      .where(eq((table as any)[deletionCol], deletionId))
    counts[resource] = rows.length
    total += rows.length
    for (const row of rows) {
      await recordRevisionIfPresent(context, resource, row.id, 'restore', { ...row, [getSoftDeleteColumn(table)!]: null })
    }
  }
  return { counts, total }
}

/**
 * Permanently purge every trashed row across all resources that shares `deletionId`.
 * Authorizes per owning resource with the `purge` permission.
 */
export async function purgeSoftDeletedBatch(context: any, deletionId: string): Promise<BatchResult> {
  const groups = await findBatchRows(context, deletionId)
  const counts: Record<string, number> = {}
  let total = 0
  for (const { resource, table, deletionCol, rows } of groups) {
    for (const row of rows) {
      await assertResourcePermission(resource, 'purge', context, { recordId: row.id })
    }
    await context.db.delete(table).where(eq((table as any)[deletionCol], deletionId))
    counts[resource] = rows.length
    total += rows.length
  }
  return { counts, total }
}
