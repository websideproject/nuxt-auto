import { defineEventHandler } from 'h3'
import { getHandler } from './get'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for get handler - GET /api/{resource}/:id
 * Imports resource config from virtual module
 */
export default defineEventHandler(async (event) => {
  const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'get')

  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  await validate(context)
  await runMiddleware('pre-execute')
  if (context.shortCircuit) {
    await runMiddleware('post-execute')
    return context.shortCircuit.data
  }
  const result = await getHandler(context)
  await runMiddleware('post-execute')
  return result
})
