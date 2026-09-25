import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, BulkOperationResponse } from '../../types'
import { getSoftDeleteColumn, buildSoftDeleteUpdates } from '../utils/softDelete'
import { cascadeSoftDelete } from '../utils/softDeleteCascade'
import { executeBeforeHook, executeAfterHook } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { filterReadableFields } from '../utils/fieldPermissions'
import { assertResourcePermission } from '../utils/permissions'
import { getAuthConfig } from '../utils/authConfig'
import { findAuthorizedRow } from '../utils/rowAccess'
import { insertReturning, updateReturning } from '../utils/returning'
import { serializeResponse } from '../utils/serializeResponse'
import { primaryKeyColumn, primaryKeyName } from '../utils/table'
import { getDatabaseAdapter } from '../database'
import { prepareCreateData } from './create'
import { prepareUpdateData, withUpdatedAt } from './update'

/**
 * Bulk routes apply the single-record rules to every item: the same body preparation (protected columns,
 * tenant stamp, field-level write gate), the same row visibility and objectLevel check, the same hooks.
 *
 * `bulk.transactional` (default `true`): the first failing item stops the batch → 400 with the per-item
 * errors, and the batch is rolled back — except on a database without transactions (D1), where the items
 * before it stay written and the error says so (`data.committed`). `false`: items are applied
 * independently and failures are reported in `meta.errors`.
 */

interface BulkItemError { index: number, id?: string | number, error: string, statusCode?: number }

function bulkConfig(context: HandlerContext) {
  const cfg = (context.runtimeConfig as any)?.autoApi?.bulk ?? {}
  return { maxBatchSize: cfg.maxBatchSize ?? 100, transactional: cfg.transactional ?? true }
}

function itemError(index: number, error: any, id?: string | number): BulkItemError {
  return { index, ...(id !== undefined ? { id } : {}), error: error?.message || 'Failed', statusCode: error?.statusCode }
}

async function runBatch<T>(
  context: HandlerContext,
  count: number,
  work: (db: any, i: number) => Promise<T>,
  idOf: (i: number) => string | number | undefined = () => undefined,
): Promise<{ results: T[], errors: BulkItemError[] }> {
  const { maxBatchSize, transactional } = bulkConfig(context)
  if (count > maxBatchSize) throw createError({ statusCode: 400, message: `Batch size exceeds maximum of ${maxBatchSize}` })

  const results: T[] = []
  const errors: BulkItemError[] = []

  if (transactional) {
    const adapter = context.adapter || getDatabaseAdapter()
    try {
      await adapter.atomic(async ({ tx }: any) => {
        for (let i = 0; i < count; i++) {
          try {
            results.push(await work(tx, i))
          }
          catch (error) {
            errors.push(itemError(i, error, idOf(i)))
            throw error
          }
        }
      })
    }
    catch (error: any) {
      if (errors.length === 0) throw error
      if (adapter.supportsTransactions === false) {
        throw createError({
          statusCode: 400,
          message: `Bulk operation failed at item ${errors[0]!.index}; the ${results.length} item(s) before it were written (${adapter.engine} has no transactions)`,
          data: { errors, committed: results.length },
        })
      }
      throw createError({ statusCode: 400, message: 'Bulk operation failed (rolled back)', data: { errors } })
    }
  }
  else {
    for (let i = 0; i < count; i++) {
      try {
        results.push(await work(context.db, i))
      }
      catch (error) {
        errors.push(itemError(i, error, idOf(i)))
      }
    }
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

  const { results, errors } = await runBatch(context, items.length, async (db, i) => {
    let data = await prepareCreateData(context, table, items[i])
    data = await executeBeforeHook('create', context, data)
    const [created] = await insertReturning(db, table, data)
    await executeAfterHook('create', context, created)
    return created
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

  const { results, errors } = await runBatch(context, items.length, async (db, i) => {
    const existing = await findAuthorizedRow(context, resource, items[i]!.id, { db })
    const id = existing[primaryKeyName(table)]
    let data = await prepareUpdateData(context, table, items[i]!.data)
    data = await executeBeforeHook('update', context, data, id)
    const updated = Object.keys(data).length === 0 ? existing : await updateReturning(db, table, id, withUpdatedAt(table, data))
    await executeAfterHook('update', context, updated)
    return updated
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

  const { results, errors } = await runBatch(context, ids.length, async (db, i) => {
    const existing = await findAuthorizedRow(context, resource, ids[i]!, { db, softDeleted: purge ? 'include' : 'exclude' })
    const id = existing[primaryKeyName(table)]
    await executeBeforeHook('delete', context, undefined, id)
    if (softCol && !purge) {
      if (cascade !== 'off') await cascadeSoftDelete({ ...context, db }, resource, id, deletionId, { reason })
      await db.update(table).set(buildSoftDeleteUpdates(table, { deletionId, reason, userId })).where(eq(primaryKeyColumn(table), id))
    }
    else {
      await db.delete(table).where(eq(primaryKeyColumn(table), id))
    }
    await executeAfterHook('delete', context, undefined, id)
    return { id, deleted: true }
  }, i => ids[i])

  const response = await respond(context, results, ids.length, errors)
  return softCol && !purge ? { ...response, meta: { ...response.meta, deletionId } } as any : response
}
