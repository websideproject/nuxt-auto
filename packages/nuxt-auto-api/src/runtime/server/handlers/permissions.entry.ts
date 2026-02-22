import { defineEventHandler } from 'h3'
import { permissionsHandler } from './permissions'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * Entry point for permissions handler - GET /api/{resource}/permissions
 * Returns permission information for the current user
 */
export default defineEventHandler(async (event) => {
  // Create context but don't require authorization since we're just checking permissions
  const { context } = await createContextFromRegistry(event, 'get')

  return await permissionsHandler(context)
})
