import { defineEventHandler } from 'h3'
import { restoreHandler } from './restore'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for restore handler - POST /api/{resource}/{id}/restore
 * Restores soft-deleted records
 */
export default defineEventHandler(async (event) => {
  const { context, authorize, runMiddleware } = await createContextFromRegistry(event, 'update')

  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  await runMiddleware('pre-execute')
  const result = await restoreHandler(context)
  await runMiddleware('post-execute')
  return result
})
