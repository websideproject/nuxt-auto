import { defineEventHandler, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { aggregateHandler } from './aggregate'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for aggregate handler - GET /api/{resource}/aggregate
 * Handles complex aggregations with groupBy and having
 */
export default defineEventHandler(async (event) => {
  // Check if aggregations are enabled
  const runtimeConfig = useRuntimeConfig?.()
  const aggregationsEnabled = runtimeConfig?.autoApi?.aggregations?.enabled ?? true

  if (!aggregationsEnabled) {
    throw createError({
      statusCode: 403,
      message: 'Aggregations are disabled',
    })
  }

  const { context, authorize, runMiddleware } = await createContextFromRegistry(event, 'aggregate')

  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  await runMiddleware('pre-execute')
  const result = await aggregateHandler(context)
  await runMiddleware('post-execute')
  return result
})
