import { defineEventHandler } from 'h3'
import { getAllJunctionTableNames } from '../../utils/m2m/detectJunctions'

/**
 * Get all junction table names
 * GET /api/_m2m/junctions
 *
 * Used by admin module to filter junction tables from sidebar
 */
export default defineEventHandler(async (event) => {
  // Get registry and schema
  const { registry } = await import('#nuxt-auto-api-registry') as any

  // Build schema from registry
  const schema: Record<string, any> = {}
  for (const [name, config] of Object.entries(registry)) {
    schema[name] = config.schema
  }

  // Get all junction tables
  const junctions = getAllJunctionTableNames(schema)

  return {
    junctions,
    count: junctions.length,
  }
})
