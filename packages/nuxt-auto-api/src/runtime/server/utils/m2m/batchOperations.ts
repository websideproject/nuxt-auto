import { eq, and, inArray, sql, getTableColumns } from 'drizzle-orm'
import type { M2MBatchOperation, M2MBatchResult, DetectedJunction } from '../../../types'
import { atomicWritesFor, chunk, MAX_IDS_PER_STATEMENT, type Write } from '../atomicWrites'

// D1 allows 100 bound parameters per statement; a multi-row insert binds one per column per row.
const MAX_PARAMS_PER_STATEMENT = 90

/**
 * The statements that apply one M2M diff to a junction table: deletes of `toRemove`, then inserts of `toAdd`
 * (with their metadata), chunked to fit a statement's bound-parameter limit. Plain awaited Drizzle queries,
 * so they run on every dialect.
 */
export function m2mWrites(junction: DetectedJunction, leftId: string | number, operation: M2MBatchOperation): Write[] {
  const { toAdd, toRemove, metadata } = operation
  const table = junction.table
  const writes: Write[] = []

  for (const ids of chunk(toRemove, MAX_IDS_PER_STATEMENT)) {
    writes.push(db => db.delete(table).where(and(eq(table[junction.leftKey], leftId), inArray(table[junction.rightKey], ids))))
  }

  const rows = toAdd.map((rightId, i) => ({ ...(metadata?.[i] ?? {}), [junction.leftKey]: leftId, [junction.rightKey]: rightId }))
  const rowsPerInsert = Math.max(1, Math.floor(MAX_PARAMS_PER_STATEMENT / Object.keys(getTableColumns(table)).length))
  for (const values of chunk(rows, rowsPerInsert)) {
    writes.push(db => db.insert(table).values(values))
  }
  return writes
}

/** Number of links a row has in the junction table. */
export async function countRelations(db: any, junction: DetectedJunction, leftId: string | number): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(junction.table).where(eq(junction.table[junction.leftKey], leftId))
  return Number(row?.count) || 0
}

/**
 * Apply an M2M diff atomically (one transaction, or one `db.batch()` on D1). `toAdd` / `toRemove` come from
 * `calculateDiff` against the current links, so they are the counts reported.
 */
export async function executeBatchM2M(
  db: any,
  junction: DetectedJunction,
  leftId: string | number,
  operation: M2MBatchOperation,
): Promise<M2MBatchResult> {
  await atomicWritesFor({ db }, m2mWrites(junction, leftId, operation))
  return { added: operation.toAdd.length, removed: operation.toRemove.length, total: await countRelations(db, junction, leftId) }
}

/** @deprecated `executeBatchM2M` chunks every statement itself; kept for existing imports. */
export function executeBatchM2MWithChunking(
  db: any,
  junction: DetectedJunction,
  leftId: string | number,
  operation: M2MBatchOperation,
): Promise<M2MBatchResult> {
  return executeBatchM2M(db, junction, leftId, operation)
}

/**
 * Get current M2M relations
 */
export async function getCurrentRelations(
  db: any,
  junction: DetectedJunction,
  leftId: string | number,
): Promise<Array<string | number>> {
  const junctionTable = junction.table

  const results = await db
    .select({ id: junctionTable[junction.rightKey] })
    .from(junctionTable)
    .where(eq(junctionTable[junction.leftKey], leftId))

  return results.map((r: any) => r.id)
}

/**
 * Calculate diff between current and desired relations
 */
export function calculateDiff(
  current: Array<string | number>,
  desired: Array<string | number>,
): { toAdd: Array<string | number>, toRemove: Array<string | number> } {
  const currentSet = new Set(current.map(String))
  const desiredSet = new Set(desired.map(String))

  const toAdd = desired.filter(id => !currentSet.has(String(id)))
  const toRemove = current.filter(id => !desiredSet.has(String(id)))

  return { toAdd, toRemove }
}

/**
 * Chunk array into smaller batches
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  return chunk(array, chunkSize)
}
