import { defineEventHandler } from 'h3'
import { allPermissionsHandler } from './allPermissions'

/**
 * Entry point for global permissions handler - GET /api/permissions
 * Returns permission information for ALL resources for the current user
 * More efficient than querying each resource individually
 */
export default defineEventHandler(async (event) => {
  return await allPermissionsHandler(event)
})
