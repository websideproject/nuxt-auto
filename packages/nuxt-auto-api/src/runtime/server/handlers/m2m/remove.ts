import { createError, readBody } from 'h3'
import type { HandlerContext, M2MOperationResponse } from '../../../types'
import { validateM2MRemoveRequest, validateIdsNotEmpty, validateBatchSize, sanitizeIds } from '../../utils/m2m/validateM2M'
import { executeBatchM2MWithChunking } from '../../utils/m2m/batchOperations'
import { executeHook } from '../../utils/executeHooks'
import { m2mPrelude, runCustomM2MCheck } from './shared'

/**
 * DELETE /api/{resource}/:id/relations/:relation/remove  `{ ids }` — unlink `ids`. Unlinking only touches
 * the parent's own junction rows, so the related rows do not have to be visible.
 */
export async function m2mRemoveHandler(context: HandlerContext): Promise<M2MOperationResponse> {
  const side = await m2mPrelude(context, 'remove')
  const body = context.validated?.body ?? await readBody(context.event)
  const validation = validateM2MRemoveRequest(body)
  if (!validation.valid) throw createError({ statusCode: 400, message: validation.error })
  validateIdsNotEmpty(validation.data!.ids)
  validateBatchSize(validation.data!.ids)
  const ids = sanitizeIds(validation.data!.ids)
  await runCustomM2MCheck(context, side, 'remove', ids, [])

  await executeHook('beforeM2MRemove', context, side.relation, ids, context)
  const result = await executeBatchM2MWithChunking(context.db, side.junction, side.leftId, { toAdd: [], toRemove: ids })

  const response: M2MOperationResponse = { success: true, removed: result.removed, total: result.removed }
  await executeHook('afterM2MRemove', context, side.relation, response, context)
  return response
}
