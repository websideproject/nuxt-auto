import { createError, readBody } from 'h3'
import type { HandlerContext, M2MOperationResponse } from '../../../types'
import { validateM2MAddRequest, validateIdsNotEmpty } from '../../utils/m2m/validateM2M'
import { executeBatchM2MWithChunking, getCurrentRelations } from '../../utils/m2m/batchOperations'
import { executeHook } from '../../utils/executeHooks'
import { alignMetadata, authorizeRelatedIds, m2mPrelude, runCustomM2MCheck, validateM2MMetadata } from './shared'

/**
 * POST /api/{resource}/:id/relations/:relation/add  `{ ids, metadata? }` — link `ids` (already linked ids
 * are left as they are).
 */
export async function m2mAddHandler(context: HandlerContext): Promise<M2MOperationResponse> {
  const side = await m2mPrelude(context, 'add')
  const body = context.validated?.body ?? await readBody(context.event)
  const validation = validateM2MAddRequest(body)
  if (!validation.valid) throw createError({ statusCode: 400, message: validation.error })
  validateIdsNotEmpty(validation.data!.ids)
  validateM2MMetadata(validation.data!.metadata, side)

  const { ids, records } = await authorizeRelatedIds(context, side, validation.data!.ids)
  const metadata = alignMetadata(validation.data!.ids, validation.data!.metadata, ids)
  await runCustomM2MCheck(context, side, 'add', ids, records, metadata)

  const hookIds = await executeHook('beforeM2MAdd', context, side.relation, ids, context)
  const wanted = Array.isArray(hookIds) ? hookIds : ids

  const current = new Set((await getCurrentRelations(context.db, side.junction, side.leftId)).map(String))
  const toAdd = wanted.filter(id => !current.has(String(id)))
  const addMetadata = metadata ? toAdd.map(id => metadata[wanted.findIndex(w => String(w) === String(id))] ?? {}) : undefined
  const result = await executeBatchM2MWithChunking(context.db, side.junction, side.leftId, { toAdd, toRemove: [], metadata: addMetadata })

  const response: M2MOperationResponse = { success: true, added: result.added, total: current.size + result.added }
  await executeHook('afterM2MAdd', context, side.relation, response, context)
  return response
}
