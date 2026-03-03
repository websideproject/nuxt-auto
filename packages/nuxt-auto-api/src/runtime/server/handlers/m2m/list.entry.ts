import { defineEventHandler } from 'h3'
import { m2mListHandler } from './list'
import { createM2MContext } from './createM2MContext'

/**
 * Entry point for M2M list handler
 * GET /api/{resource}/:id/relations/:relation
 */
export default defineEventHandler(async (event) => {
  const { context, runMiddleware } = await createM2MContext(event)
  await runMiddleware('pre-auth')
  await runMiddleware('post-auth')
  await runMiddleware('pre-execute')
  const result = await m2mListHandler(context)
  await runMiddleware('post-execute')
  return result
})
