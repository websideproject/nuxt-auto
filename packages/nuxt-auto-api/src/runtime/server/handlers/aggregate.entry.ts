import { createError, defineEventHandler } from 'h3'
import { aggregateHandler } from './aggregate'
import { runResourcePipeline } from './pipeline'
import { useRuntimeConfig } from 'nitropack/runtime'

/** GET /api/{resource}/aggregate — gated by `permissions.aggregate` → `read`. */
export default defineEventHandler(async (event) => {
  if ((useRuntimeConfig() as any).autoApi?.aggregations?.enabled === false) {
    throw createError({ statusCode: 404, message: 'Aggregations are disabled' })
  }
  return runResourcePipeline(event, 'aggregate', aggregateHandler)
})
