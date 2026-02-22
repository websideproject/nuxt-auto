import { defineEventHandler } from 'h3'
import { updateHandler } from './update'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for update handler - PATCH /api/{resource}/:id
 * Imports resource config from virtual module
 */
export default defineEventHandler(async (event) => {
  const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'update')

  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  await validate(context)
  await runMiddleware('pre-execute')
  const result = await updateHandler(context)
  await runMiddleware('post-execute')
  return result
})
