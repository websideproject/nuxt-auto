import { defineEventHandler } from 'h3'
import { createHandler } from './create'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for create handler - POST /api/{resource}
 * Imports resource config from virtual module
 */
export default defineEventHandler(async (event) => {
  const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'create')

  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  await validate(context)
  await runMiddleware('pre-execute')
  const result = await createHandler(context)
  await runMiddleware('post-execute')
  return result
})
