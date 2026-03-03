import { defineEventHandler, getRouterParam, createError } from 'h3'
import { isJunctionTable } from '../../utils/m2m/detectJunctions'

/**
 * Check if a table is a junction table
 * GET /api/_m2m/is-junction/:table
 *
 * Used by admin module to filter junction tables from sidebar
 */
export default defineEventHandler(async (event) => {
  const tableName = getRouterParam(event, 'table')

  if (!tableName) {
    throw createError({
      statusCode: 400,
      message: 'Table name is required',
    })
  }

  // Get registry and schema
  const { registry } = await import('#nuxt-auto-api-registry') as any

  // Build schema from registry
  const schema: Record<string, any> = {}
  for (const [name, config] of Object.entries(registry)) {
    schema[name] = config.schema
  }

  // Check if it's a junction table
  const isJunction = isJunctionTable(tableName, schema)

  return {
    table: tableName,
    isJunction,
  }
})
