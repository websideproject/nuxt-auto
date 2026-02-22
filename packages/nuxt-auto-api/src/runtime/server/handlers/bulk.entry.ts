import { defineEventHandler, getMethod } from 'h3'
import { bulkCreateHandler, bulkUpdateHandler, bulkDeleteHandler } from './bulk'
import { createContextFromRegistry } from './createContextFromRegistry'
import { createError } from 'h3'

/**
 * Entry point for bulk operations - /api/{resource}/bulk
 * POST - bulk create
 * PATCH - bulk update
 * DELETE - bulk delete
 */
export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  // Check if bulk operations are enabled
  const runtimeConfig = useRuntimeConfig?.()
  const bulkEnabled = runtimeConfig?.autoApi?.bulk?.enabled ?? true

  if (!bulkEnabled) {
    throw createError({
      statusCode: 403,
      message: 'Bulk operations are disabled',
    })
  }

  if (method === 'POST') {
    const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'create')
    await runMiddleware('pre-auth')
    await authorize(context)
    await runMiddleware('post-auth')
    await validate(context)
    await runMiddleware('pre-execute')
    const result = await bulkCreateHandler(context)
    await runMiddleware('post-execute')
    return result
  } else if (method === 'PATCH') {
    const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'update')
    await runMiddleware('pre-auth')
    await authorize(context)
    await runMiddleware('post-auth')
    await validate(context)
    await runMiddleware('pre-execute')
    const result = await bulkUpdateHandler(context)
    await runMiddleware('post-execute')
    return result
  } else if (method === 'DELETE') {
    const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, 'delete')
    await runMiddleware('pre-auth')
    await authorize(context)
    await runMiddleware('post-auth')
    await validate(context)
    await runMiddleware('pre-execute')
    const result = await bulkDeleteHandler(context)
    await runMiddleware('post-execute')
    return result
  } else {
    throw createError({
      statusCode: 405,
      message: `Method ${method} not allowed for bulk operations`,
    })
  }
})
