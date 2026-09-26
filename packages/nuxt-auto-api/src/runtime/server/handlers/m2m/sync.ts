import { createError, readBody } from 'h3'
import type { HandlerContext, M2MOperationResponse } from '../../../types'
import { validateM2MSyncRequest } from '../../utils/m2m/validateM2M'
import { executeBatchM2M, getCurrentRelations, calculateDiff } from '../../utils/m2m/batchOperations'
import { executeHook } from '../../utils/executeHooks'
import { alignMetadata, authorizeRelatedIds, m2mPrelude, runCustomM2MCheck, validateM2MMetadata } from './shared'

/**
 * POST /api/{resource}/:id/relations/:relation  `{ ids, metadata? }` — make the linked set exactly `ids`.
 */
export async function m2mSyncHandler(context: HandlerContext): Promise<M2MOperationResponse> {
  const side = await m2mPrelude(context, 'sync')
  const body = context.validated?.body ?? await readBody(context.event)
  const validation = validateM2MSyncRequest(body)
  if (!validation.valid) throw createError({ statusCode: 400, message: validation.error })
  validateM2MMetadata(validation.data!.metadata, side)

  const { ids, records } = await authorizeRelatedIds(context, side, validation.data!.ids)
  const metadata = alignMetadata(validation.data!.ids, validation.data!.metadata, ids)
  await runCustomM2MCheck(context, side, 'sync', ids, records, metadata)

  const hookIds = await executeHook('beforeM2MSync', context, side.relation, ids, context)
  const desired = Array.isArray(hookIds) ? hookIds : ids

  const current = await getCurrentRelations(context.db, side.junction, side.leftId)
  const { toAdd, toRemove } = calculateDiff(current, desired)
  const addMetadata = metadata ? toAdd.map(id => metadata[desired.findIndex(d => String(d) === String(id))] ?? {}) : undefined
  const result = await executeBatchM2M(context.db, side.junction, side.leftId, { toAdd, toRemove, metadata: addMetadata })

  const response: M2MOperationResponse = { success: true, added: result.added, removed: result.removed, total: desired.length }
  await executeHook('afterM2MSync', context, side.relation, response, context)
  return response
}
