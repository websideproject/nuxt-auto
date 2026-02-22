import { defineEventHandler } from 'h3'
import { listHandler } from './list'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for list handler - GET /api/{resource}
 * Imports resource config from virtual module
 */
export default defineEventHandler(async (event) => {
  const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'list')

  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  await validate(context)
  await runMiddleware('pre-execute')
  if (context.shortCircuit) {
    await runMiddleware('post-execute')
    return context.shortCircuit.data
  }
  const result = await listHandler(context)
  await runMiddleware('post-execute')
  return result
})
