import { eq, and, inArray, sql, count } from 'drizzle-orm'
import type { M2MBatchOperation, M2MBatchResult, DetectedJunction } from '../../../types'
import { getDatabaseAdapter } from '../../database'

/**
 * Core M2M transaction logic - shared by adapter and legacy paths
 */
function executeM2MInTx(
  tx: any,
  junction: DetectedJunction,
  leftId: string | number,
  toAdd: Array<string | number>,
  toRemove: Array<string | number>,
  metadata?: Record<string, any>[],
  adapter?: import('../../../types/database').DatabaseAdapter,
): M2MBatchResult {
  const junctionTable = junction.table

  // 1. DELETE removed relations (batch)
  let removedCount = 0
  if (toRemove.length > 0) {
    const deleteResult = tx
      .delete(junctionTable)
      .where(
        and(
          eq(junctionTable[junction.leftKey], leftId),
          inArray(junctionTable[junction.rightKey], toRemove)
        )
      )
      .run()

    removedCount = adapter
      ? adapter.getMutationCount(deleteResult)
      : (deleteResult.changes ?? deleteResult.length ?? 0)
  }

  // 2. INSERT new relations (batch)
  let addedCount = 0
  if (toAdd.length > 0) {
    const values = toAdd.map((rightId, index) => {
      const baseValue: Record<string, any> = {
        [junction.leftKey]: leftId,
        [junction.rightKey]: rightId,
      }
      if (metadata && metadata[index]) {
        Object.assign(baseValue, metadata[index])
      }
      return baseValue
    })

    const insertResult = tx
      .insert(junctionTable)
      .values(values)
      .run()

    addedCount = adapter
      ? adapter.getMutationCount(insertResult)
      : (insertResult.changes ?? insertResult.length ?? toAdd.length)
  }

  // 3. Get total count after operation
  const countResults = tx
    .select({ count: sql<number>`count(*)` })
    .from(junctionTable)
    .where(eq(junctionTable[junction.leftKey], leftId))
    .all()

  const totalCount = Number(countResults[0]?.count) || 0

  return {
    added: addedCount,
    removed: removedCount,
    total: totalCount,
  }
}

/**
 * Execute batch M2M operations (add/remove in a single transaction)
 *
 * Performance: Reduces N+1 queries to 3 queries total:
 * - 1 SELECT (to get current relations)
 * - 1 DELETE (batch delete)
 * - 1 INSERT (batch insert)
 *
 * Example: Syncing 50 relations
 * - Old approach: 100+ queries (50 DELETE + 50 INSERT)
 * - New approach: 3 queries (1 SELECT + 1 DELETE + 1 INSERT)
 * - Result: 97% query reduction
 */
export async function executeBatchM2M(
  db: any,
  junction: DetectedJunction,
  leftId: string | number,
  operation: M2MBatchOperation
): Promise<M2MBatchResult> {
  const { toAdd, toRemove, metadata } = operation
  const junctionTable = junction.table

  // Use adapter for engine-agnostic transaction handling
  let adapter
  try {
    adapter = getDatabaseAdapter()
  } catch {
    // Fallback to legacy behavior
  }

  if (adapter) {
    return adapter.atomic(({ tx }) => {
      return executeM2MInTx(tx, junction, leftId, toAdd, toRemove, metadata, adapter!)
    })
  }

  // Legacy fallback: direct db.transaction
  const result = db.transaction((tx: any) => {
    return executeM2MInTx(tx, junction, leftId, toAdd, toRemove, metadata)
  })

  return result
}

/**
 * Get current M2M relations
 */
export async function getCurrentRelations(
  db: any,
  junction: DetectedJunction,
  leftId: string | number
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
  desired: Array<string | number>
): { toAdd: Array<string | number>, toRemove: Array<string | number> } {
  const currentSet = new Set(current.map(String))
  const desiredSet = new Set(desired.map(String))

  const toAdd = desired.filter(id => !currentSet.has(String(id)))
  const toRemove = current.filter(id => !desiredSet.has(String(id)))

  return { toAdd, toRemove }
}


/**
 * Chunk array into smaller batches
 * Useful for very large operations to avoid hitting query size limits
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Execute batch M2M operations with chunking for large batches
 */
export async function executeBatchM2MWithChunking(
  db: any,
  junction: DetectedJunction,
  leftId: string | number,
  operation: M2MBatchOperation,
  chunkSize = 500
): Promise<M2MBatchResult> {
  const { toAdd, toRemove, metadata } = operation

  // If under chunk size, use regular batch operation
  if (toAdd.length <= chunkSize && toRemove.length <= chunkSize) {
    return executeBatchM2M(db, junction, leftId, operation)
  }

  let adapter
  try {
    adapter = getDatabaseAdapter()
  } catch {
    // Fallback to legacy behavior
  }

  const runChunked = (tx: any) => {
    const junctionTable = junction.table
    let totalAdded = 0
    let totalRemoved = 0

    // Process removals in chunks
    if (toRemove.length > 0) {
      const removeChunks = chunkArray(toRemove, chunkSize)
      for (const chunk of removeChunks) {
        const deleteResult = tx
          .delete(junctionTable)
          .where(
            and(
              eq(junctionTable[junction.leftKey], leftId),
              inArray(junctionTable[junction.rightKey], chunk)
            )
          )
          .run()
        totalRemoved += adapter
          ? adapter.getMutationCount(deleteResult)
          : (deleteResult.changes ?? deleteResult.length ?? 0)
      }
    }

    // Process additions in chunks
    if (toAdd.length > 0) {
      const addChunks = chunkArray(toAdd, chunkSize)
      let metadataOffset = 0

      for (const chunk of addChunks) {
        const values = chunk.map((rightId, index) => {
          const baseValue: Record<string, any> = {
            [junction.leftKey]: leftId,
            [junction.rightKey]: rightId,
          }

          if (metadata) {
            const metaIndex = metadataOffset + index
            if (metadata[metaIndex]) {
              Object.assign(baseValue, metadata[metaIndex])
            }
          }

          return baseValue
        })

        const insertResult = tx
          .insert(junctionTable)
          .values(values)
          .run()

        totalAdded += adapter
          ? adapter.getMutationCount(insertResult)
          : (insertResult.changes ?? insertResult.length ?? chunk.length)
        metadataOffset += chunk.length
      }
    }

    // Get total count after operation
    const countResults = tx
      .select({ count: sql<number>`count(*)` })
      .from(junctionTable)
      .where(eq(junctionTable[junction.leftKey], leftId))
      .all()

    return {
      added: totalAdded,
      removed: totalRemoved,
      total: Number(countResults[0]?.count) || 0,
    }
  }

  if (adapter) {
    return adapter.atomic(async ({ tx }) => runChunked(tx))
  }

  // Legacy fallback
  return db.transaction((tx: any) => runChunked(tx))
}
