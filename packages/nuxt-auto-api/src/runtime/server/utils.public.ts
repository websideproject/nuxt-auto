// Public barrel for the `@websideproject/nuxt-auto-api/utils` subpath.
//
// IMPORTANT: this lives OUTSIDE the `./utils/` directory on purpose. `addServerImportsDir(./utils)`
// scans that directory for server auto-imports; if this barrel sat inside it, every re-exported
// symbol would be registered twice (once from its source file, once from the barrel) and Nuxt would
// log "Duplicated imports …, one ignored" for each. Keeping the barrel a sibling file means the dir
// scan sees only the leaf source files (no duplicates) while consumers still import from `…/utils`.

/** @deprecated Use `createEndpoint()` instead */
export { defineAutoApiHandler } from './utils/defineAutoApiHandler'
export type { AutoApiHandlerOptions } from './utils/defineAutoApiHandler'

export { checkPermission, checkFieldPermission, getResourcePermissions } from './utils/permissions'

// Database adapter
export { initializeDatabase, getDatabaseAdapter, createAdapter } from './database'

// Custom endpoint helpers
export { createEndpoint } from './utils/createEndpoint'
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
} from './utils/helpers'

// Re-export response utilities
export { serializeResponse } from './utils/serializeResponse'
export { filterHiddenFields } from './utils/filterHiddenFields'
