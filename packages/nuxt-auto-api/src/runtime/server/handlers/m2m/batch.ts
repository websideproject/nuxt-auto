import { createError, readBody } from 'h3'
import type { HandlerContext, M2MBatchSyncRequest, M2MBatchSyncResponse } from '../../../types'
import { getCurrentRelations, calculateDiff, m2mWrites } from '../../utils/m2m/batchOperations'
import { executeHook } from '../../utils/executeHooks'
import { atomicWritesFor, type Write } from '../../utils/atomicWrites'
import { alignMetadata, authorizeRelatedIds, m2mPrelude, runCustomM2MCheck, validateM2MMetadata } from './shared'

/**
 * POST /api/{resource}/:id/relations/batch  `{ relations: { tags: { ids, metadata? }, … } }` — sync several
 * relations at once. Every relation is authorized before anything is written, and all the writes are applied
 * together — one transaction, or one `db.batch()` on D1.
 */
export async function m2mBatchHandler(context: HandlerContext): Promise<M2MBatchSyncResponse> {
  const body = context.validated?.body ?? await readBody(context.event) as M2MBatchSyncRequest
  if (!body || typeof body !== 'object' || !body.relations || typeof body.relations !== 'object' || Array.isArray(body.relations)) {
    throw createError({ statusCode: 400, message: 'Request body must include a "relations" object' })
  }
  const entries = Object.entries(body.relations) as Array<[string, { ids: Array<string | number>, metadata?: Array<Record<string, any>> } | undefined]>
  if (entries.length === 0) throw createError({ statusCode: 400, message: 'relations must be a non-empty object' })

  const plans: Array<{ side: Awaited<ReturnType<typeof m2mPrelude>>, ids: Array<string | number>, metadata?: Array<Record<string, any>> }> = []
  for (const [relation, data] of entries) {
    if (!data || !Array.isArray(data.ids)) throw createError({ statusCode: 400, message: `relations.${relation}.ids must be an array` })
    const side = await m2mPrelude(context, 'sync', relation)
    validateM2MMetadata(data.metadata, side)
    const { ids, records } = await authorizeRelatedIds(context, side, data.ids)
    const metadata = alignMetadata(data.ids, data.metadata, ids)
    await runCustomM2MCheck(context, side, 'sync', ids, records, metadata)
    const hookIds = await executeHook('beforeM2MSync', context, relation, ids, context)
    plans.push({ side, ids: Array.isArray(hookIds) ? hookIds : ids, metadata })
  }

  const results: M2MBatchSyncResponse['results'] = {}
  const writes: Write[] = []
  for (const { side, ids, metadata } of plans) {
    const current = await getCurrentRelations(context.db, side.junction, side.leftId)
    const { toAdd, toRemove } = calculateDiff(current, ids)
    const addMetadata = metadata ? toAdd.map(id => metadata[ids.findIndex((d: string | number) => String(d) === String(id))] ?? {}) : undefined
    writes.push(...m2mWrites(side.junction, side.leftId, { toAdd, toRemove, metadata: addMetadata }))
    results[side.relation] = { added: toAdd.length, removed: toRemove.length, total: ids.length }
  }
  await atomicWritesFor(context, writes)

  for (const { side } of plans) await executeHook('afterM2MSync', context, side.relation, results[side.relation], context)
  return { success: true, results }
}
