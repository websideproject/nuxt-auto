import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, BulkOperationResponse } from '../../types'
import { getSoftDeleteColumn, buildSoftDeleteUpdates } from '../utils/softDelete'
import { planCascadeSoftDelete } from '../utils/softDeleteCascade'
import { atomicWritesFor, type Write } from '../utils/atomicWrites'
import { executeBeforeHook, executeAfterHook } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { filterReadableFields } from '../utils/fieldPermissions'
import { assertResourcePermission } from '../utils/permissions'
import { getAuthConfig } from '../utils/authConfig'
import { findAuthorizedRow } from '../utils/rowAccess'
import { insertReturningQuery, updateReturningQuery } from '../utils/returning'
import { serializeResponse } from '../utils/serializeResponse'
import { primaryKeyColumn, primaryKeyName } from '../utils/table'
import { prepareCreateData } from './create'
import { prepareUpdateData, withUpdatedAt } from './update'

/**
 * Bulk routes apply the single-record rules to every item: the same body preparation (protected columns,
 * tenant stamp, field-level write gate), the same row visibility and objectLevel check, the same hooks.
 *
 * `bulk.transactional` (default `true`) — all or nothing, on every engine:
 *  1. every item is checked and its before-hook run, with nothing written yet — the first failure is a 400
 *     with that item's error (`data.errors`)
 *  2. all the writes are applied together: one transaction, or one `db.batch()` on D1 (which has no
 *     interactive transactions) — a database error rolls every item back (400)
 *  3. the after-hooks run, once the writes are committed.
 * `false`: each item is applied on its own (its own writes still atomic) and failures are reported in
 * `meta.errors`.
 */

interface BulkItemError { index: number, id?: string | number, error: string, statusCode?: number }

/** One item's writes, and what to do with their results once they are committed. */
interface ItemPlan<T> { writes: Write[], finish: (results: any[]) => Promise<T> }

function bulkConfig(context: HandlerContext) {
  const cfg = (context.runtimeConfig as any)?.autoApi?.bulk ?? {}
  return { maxBatchSize: cfg.maxBatchSize ?? 100, transactional: cfg.transactional ?? true }
}

/**
 * The message a client may see: an HTTP error's own (404, 403, validation), never a database error's — Drizzle's
 * carries the SQL and its bound values. Those are logged instead.
 */
function clientMessage(error: any): string {
  if (typeof error?.statusCode === 'number') return error.message || 'Failed'
  console.error('[nuxt-auto-api] bulk write failed:', error)
  return 'The database rejected this item'
}

function itemError(index: number, error: any, id?: string | number): BulkItemError {
  return { index, ...(id !== undefined ? { id } : {}), error: clientMessage(error), statusCode: error?.statusCode }
}

async function runBatch<T>(
  context: HandlerContext,
  count: number,
  plan: (i: number) => Promise<ItemPlan<T>>,
  idOf: (i: number) => string | number | undefined = () => undefined,
): Promise<{ results: T[], errors: BulkItemError[] }> {
  const { maxBatchSize, transactional } = bulkConfig(context)
  if (count > maxBatchSize) throw createError({ statusCode: 400, message: `Batch size exceeds maximum of ${maxBatchSize}` })

  const results: T[] = []
  const errors: BulkItemError[] = []

  if (!transactional) {
    for (let i = 0; i < count; i++) {
      try {
        const item = await plan(i)
        results.push(await item.finish(await atomicWritesFor(context, item.writes)))
      }
      catch (error) {
        errors.push(itemError(i, error, idOf(i)))
      }
    }
    return { results, errors }
  }

  const plans: ItemPlan<T>[] = []
  for (let i = 0; i < count; i++) {
    try {
      plans.push(await plan(i))
    }
    catch (error) {
      throw createError({ statusCode: 400, message: 'Bulk operation failed (nothing was written)', data: { errors: [itemError(i, error, idOf(i))] } })
    }
  }

  // Which item each write belongs to, to name the item when the database rejects one of its statements.
  const owner = plans.flatMap((item, i) => item.writes.map(() => i))
  let written: any[]
  try {
    written = await atomicWritesFor(context, plans.flatMap(item => item.writes))
  }
  catch (error: any) {
    // The item is known when the engine ran the statements one by one; a D1 batch fails as a whole.
    const index = typeof error?.writeIndex === 'number' ? owner[error.writeIndex] : undefined
    throw createError({
      statusCode: 400,
      message: 'Bulk operation failed (rolled back)',
      data: { errors: [index !== undefined ? itemError(index, error, idOf(index)) : { error: clientMessage(error) }] },
    })
  }

  let offset = 0
  for (const item of plans) {
    results.push(await item.finish(written.slice(offset, offset + item.writes.length)))
    offset += item.writes.length
  }
  return { results, errors }
}

async function respond(context: HandlerContext, rows: any[], total: number, errors: BulkItemError[]): Promise<BulkOperationResponse> {
  const data = await filterReadableFields(filterHiddenFields(rows, context), context)
  return {
    data: serializeResponse(data),
    meta: { total, successful: rows.length, failed: errors.length, ...(errors.length ? { errors } : {}) },
  }
}

/** Bulk create - POST /api/[resource]/bulk  `{ items: [...] }` */
export async function bulkCreateHandler(context: HandlerContext): Promise<BulkOperationResponse> {
  const table = context.schema[context.resource]
  const items: any[] = context.validated.body?.items ?? []

  const { results, errors } = await runBatch(context, items.length, async (i) => {
    let data = await prepareCreateData(context, table, items[i])
    data = await executeBeforeHook('create', context, data)
    return {
      writes: [tx => insertReturningQuery(tx, table, data)],
      finish: async ([[created]]) => {
        await executeAfterHook('create', context, created)
        return created
      },
    }
  })
  return respond(context, results, items.length, errors)
}

/** Bulk update - PATCH /api/[resource]/bulk  `{ items: [{ id, data }] }` */
export async function bulkUpdateHandler(context: HandlerContext): Promise<BulkOperationResponse> {
  const { resource } = context
  const table = context.schema[resource]
  const items: Array<{ id: string | number, data: any }> = context.validated.body?.items ?? []
  items.forEach((item, i) => {
    if (!item || item.id === undefined || item.id === null || !item.data || typeof item.data !== 'object') {
      throw createError({ statusCode: 400, message: `Item at index ${i} must have "id" and "data"` })
    }
  })

  const { results, errors } = await runBatch(context, items.length, async (i) => {
    const existing = await findAuthorizedRow(context, resource, items[i]!.id)
    const id = existing[primaryKeyName(table)]
    let data = await prepareUpdateData(context, table, items[i]!.data)
    data = await executeBeforeHook('update', context, data, id)
    // A body made only of server-owned columns changes nothing (and an empty SET is invalid SQL).
    const set = Object.keys(data).length === 0 ? null : withUpdatedAt(table, data)
    return {
      writes: set ? [tx => updateReturningQuery(tx, table, id, set)] : [],
      finish: async ([rows]) => {
        const updated = rows?.[0] ?? existing
        await executeAfterHook('update', context, updated)
        return updated
      },
    }
  }, i => items[i]?.id)
  return respond(context, results, items.length, errors)
}

/** Bulk delete - DELETE /api/[resource]/bulk  `{ ids: [...] }`  (`?force=true` purges) */
export async function bulkDeleteHandler(context: HandlerContext): Promise<BulkOperationResponse> {
  const { resource, query } = context
  const table = context.schema[resource]
  const ids: Array<string | number> = context.validated.body?.ids ?? []

  const softCol = getSoftDeleteColumn(table)
  const purge = !!softCol && ((query as any)?.force === true || (query as any)?.force === 'true')
  if (purge) await assertResourcePermission(resource, 'purge', context)

  // One server-generated deletionId for the whole batch, so a batch restore/purge acts on the unit.
  const deletionId = crypto.randomUUID()
  const reason = (query as any)?.reason ? String((query as any).reason) : null
  const userId = context.user?.id != null ? String(context.user.id) : null
  const cascade = getAuthConfig(context, resource)?.softDelete?.cascade

  const { results, errors } = await runBatch(context, ids.length, async (i) => {
    const existing = await findAuthorizedRow(context, resource, ids[i]!, { softDeleted: purge ? 'include' : 'exclude' })
    const id = existing[primaryKeyName(table)]
    const pkWhere = eq(primaryKeyColumn(table), id)
    await executeBeforeHook('delete', context, undefined, id)
    const writes: Write[] = []
    if (softCol && !purge) {
      if (cascade !== 'off') writes.push(...(await planCascadeSoftDelete(context, resource, id, deletionId, { reason })).writes)
      const stamp = buildSoftDeleteUpdates(table, { deletionId, reason, userId })
      writes.push(tx => tx.update(table).set(stamp).where(pkWhere))
    }
    else {
      writes.push(tx => tx.delete(table).where(pkWhere))
    }
    return {
      writes,
      finish: async () => {
        await executeAfterHook('delete', context, undefined, id)
        return { id, deleted: true }
      },
    }
  }, i => ids[i])

  const response = await respond(context, results, ids.length, errors)
  return softCol && !purge ? { ...response, meta: { ...response.meta, deletionId } } as any : response
}
