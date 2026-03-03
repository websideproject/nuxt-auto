import { defineEventHandler } from 'h3'
import { deleteHandler } from './delete'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for delete handler - DELETE /api/{resource}/:id
 * Imports resource config from virtual module
 */
export default defineEventHandler(async (event) => {
  const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'delete')

  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  await validate(context)
  await runMiddleware('pre-execute')
  const result = await deleteHandler(context)
  await runMiddleware('post-execute')
  return result
})
