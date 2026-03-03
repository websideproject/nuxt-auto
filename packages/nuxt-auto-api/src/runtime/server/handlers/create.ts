import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { executeBeforeHook, executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'

/**
 * Create handler - POST /api/[resource]
 */
export async function createHandler(context: HandlerContext): Promise<SingleResponse> {
  const { db, schema, event, resource } = context

  // Get the table from schema
  const table = schema[resource]
  if (!table) {
    throw new Error(`Table ${resource} not found in schema`)
  }

  // Use validated body from validation middleware
  // Note: validation middleware already reads and validates the body
  let data = context.validated.body

  if (!data || typeof data !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Request body is required',
    })
  }

  // Auto-set tenant ID if multi-tenancy is enabled
  if (context.tenant) {
    data[context.tenant.field] = context.tenant.id
  }

  // Execute beforeCreate hook (can modify data)
  data = await executeBeforeHook('create', context, data)

  // Insert the record
  const [created] = await db.insert(table).values(data).returning()

  if (!created) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create record',
    })
  }

  // Execute afterCreate hook (may transform data, e.g., API Token plugin)
  let result = await executeAfterHookWithTransform('create', context, created)

  // Filter hidden fields from response
  const filteredData = filterHiddenFields(result, context)

  return {
    data: filteredData,
  }
}
