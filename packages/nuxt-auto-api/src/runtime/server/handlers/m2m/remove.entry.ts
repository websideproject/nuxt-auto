import { defineEventHandler } from 'h3'
import { m2mRemoveHandler } from './remove'
import { createM2MContext } from './createM2MContext'

/**
 * Entry point for M2M remove handler
 * DELETE /api/{resource}/:id/relations/:relation/remove
 */
export default defineEventHandler(async (event) => {
  const { context, runMiddleware } = await createM2MContext(event)
  await runMiddleware('pre-auth')
  await runMiddleware('post-auth')
  await runMiddleware('pre-execute')
  const result = await m2mRemoveHandler(context)
  await runMiddleware('post-execute')
  return result
})
