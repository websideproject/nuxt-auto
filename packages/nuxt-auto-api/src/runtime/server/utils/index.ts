/** @deprecated Use `createEndpoint()` instead */
export { defineAutoApiHandler } from './defineAutoApiHandler'
export type { AutoApiHandlerOptions } from './defineAutoApiHandler'

export { checkPermission, checkFieldPermission, getResourcePermissions } from './permissions'

// Database adapter
export { initializeDatabase, getDatabaseAdapter, createAdapter } from '../database'

// Custom endpoint helpers
export { createEndpoint } from './createEndpoint'
export {
  getAutoApiContext,
  validateBody,
  validateQuery,
  respondWith,
  respondWithList,
  respondWithError,
  getDb,
  getResourceSchema,
  getRegistry,
  serialize,
  filterHidden,
} from './helpers'

// Re-export response utilities
export { serializeResponse } from './serializeResponse'
export { filterHiddenFields } from './filterHiddenFields'
