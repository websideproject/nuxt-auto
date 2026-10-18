import { createError, defineEventHandler } from 'h3'
import { getAllJunctionTableNames } from '../../utils/m2m/detectJunctions'
import { createCallerContext } from '../createContextFromRegistry'
import { junctionDiscoveryTables } from './shared'

/**
 * Get all junction table names
 * GET /api/_m2m/junctions
 *
 * Used by admin module to filter junction tables from sidebar
 */
export default defineEventHandler(async (event) => {
  // Discovery reveals schema structure: signed-in callers only.
  const caller = await createCallerContext(event)
  if (!caller.user) throw createError({ statusCode: 401, message: 'Authentication required' })

  // Get all junction tables
  const { tables, resourceNames } = junctionDiscoveryTables(caller)
  const junctions = getAllJunctionTableNames(tables, resourceNames)

  return {
    junctions,
    count: junctions.length,
  }
})
