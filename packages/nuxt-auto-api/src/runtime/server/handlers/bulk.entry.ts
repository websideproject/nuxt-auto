import { createError, defineEventHandler, getMethod } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { bulkCreateHandler, bulkUpdateHandler, bulkDeleteHandler } from './bulk'
import { runResourcePipeline } from './pipeline'

/**
 * /api/{resource}/bulk — POST creates `{ items: [...] }`, PATCH updates `{ items: [{ id, data }] }`,
 * DELETE removes `{ ids: [...] }`. Gated by the create / update / delete permission; every item is
 * validated and authorized exactly like its single-record route.
 */
export default defineEventHandler(async (event) => {
  if ((useRuntimeConfig() as any).autoApi?.bulk?.enabled === false) {
    throw createError({ statusCode: 404, message: 'Bulk operations are disabled' })
  }
  const method = getMethod(event)
  if (method === 'POST') return runResourcePipeline(event, 'create', bulkCreateHandler, { bulk: true })
  if (method === 'PATCH') return runResourcePipeline(event, 'update', bulkUpdateHandler, { bulk: true })
  if (method === 'DELETE') return runResourcePipeline(event, 'delete', bulkDeleteHandler, { bulk: true })
  throw createError({ statusCode: 405, message: `Method ${method} not allowed for bulk operations` })
})
