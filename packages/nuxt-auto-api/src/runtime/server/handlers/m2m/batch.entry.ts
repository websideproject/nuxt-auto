import { defineEventHandler } from 'h3'
import { m2mBatchHandler } from './batch'
import { createM2MContext } from './createM2MContext'

/**
 * Entry point for M2M batch handler
 * POST /api/{resource}/:id/relations/batch
 */
export default defineEventHandler(async (event) => {
  const { context, runMiddleware } = await createM2MContext(event)
  await runMiddleware('pre-auth')
  await runMiddleware('post-auth')
  await runMiddleware('pre-execute')
  const result = await m2mBatchHandler(context)
  await runMiddleware('post-execute')
  return result
})
