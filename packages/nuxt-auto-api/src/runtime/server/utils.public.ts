// Public barrel for the `@websideproject/nuxt-auto-api/utils` subpath.
//
// IMPORTANT: this lives OUTSIDE the `./utils/` directory on purpose. `addServerImportsDir(./utils)`
// scans that directory for server auto-imports; if this barrel sat inside it, every re-exported
// symbol would be registered twice (once from its source file, once from the barrel) and Nuxt would
// log "Duplicated imports …, one ignored" for each. Keeping the barrel a sibling file means the dir
// scan sees only the leaf source files (no duplicates) while consumers still import from `…/utils`.

// Permissions — one evaluator, deny by default (see utils/permissions.ts).
export {
  evaluatePermission,
  resolvePermission,
  checkPermission,
  assertPermission,
  checkFieldPermission,
  getResourcePermissions,
  assertResourcePermission,
} from './utils/permissions'
export type { PermissionOperation } from './utils/permissions'
export { getAuthConfig, mergeAuthConfig } from './utils/authConfig'

// Row visibility (tenant + listFilter + soft delete + objectLevel) — use these in custom endpoints that read
// or write a resource's rows, so they apply the same rules as the generated routes.
export { rowScope, findAuthorizedRow, findAuthorizedRows, passesObjectLevel, contextFor } from './utils/rowAccess'
export { tenantCondition, resolveTenant, isTenantScoped, tenantWriteField } from './utils/tenant'
export { readableColumns, hiddenFieldsOf } from './utils/queryFields'
export { protectedFieldsFor, stripProtectedFields } from './utils/protectedFields'
export { buildWhereClause, parseFilterParam } from './utils/buildWhereClause'
export { parseSort, buildOrderBy } from './utils/buildOrderBy'
export { insertReturning, updateReturning, supportsReturning } from './utils/returning'
// All-or-nothing writes on every engine — a transaction, or one db.batch() on D1
export { atomicWrites, atomicWritesFor } from './utils/atomicWrites'
export type { Write } from './utils/atomicWrites'
export { primaryKeyName, primaryKeyColumn } from './utils/table'

// Field-level read/write enforcement. The CRUD handlers apply these already; they are exported so a custom
// endpoint that writes or returns a resource's columns can honour the same `fields[x]` declarations
// instead of quietly bypassing them.
export { assertWritableFields, deniedWriteFields, filterReadableFields } from './utils/fieldPermissions'

// Soft-delete helpers (detection + companion columns + view-deleted gate + stamp builders)
export {
  getSoftDeleteColumn,
  getSoftDeleteCompanions,
  supportsSoftDelete,
  canViewSoftDeleted,
  buildSoftDeleteUpdates,
  buildRestoreUpdates,
} from './utils/softDelete'
export { cascadeSoftDelete } from './utils/softDeleteCascade'
export { restoreSoftDeletedBatch, purgeSoftDeletedBatch } from './utils/softDeleteBatch'
export type { BatchResult } from './utils/softDeleteBatch'
export { recordRevisionIfPresent } from './utils/revisionRecord'

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
