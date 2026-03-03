import { defineEventHandler } from 'h3'
import { m2mAddHandler } from './add'
import { createM2MContext } from './createM2MContext'

/**
 * Entry point for M2M add handler
 * POST /api/{resource}/:id/relations/:relation/add
 */
export default defineEventHandler(async (event) => {
  const { context, runMiddleware } = await createM2MContext(event)
  await runMiddleware('pre-auth')
  await runMiddleware('post-auth')
  await runMiddleware('pre-execute')
  const result = await m2mAddHandler(context)
  await runMiddleware('post-execute')
  return result
})
