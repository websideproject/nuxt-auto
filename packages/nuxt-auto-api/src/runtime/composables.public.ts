// Public barrel for the `@websideproject/nuxt-auto-api/composables` subpath.
//
// IMPORTANT: kept OUTSIDE the `./composables/` directory on purpose. `addImportsDir(./composables)`
// scans that directory for client auto-imports; if this barrel sat inside it, every re-exported
// composable would be registered twice (source file + barrel) and Nuxt would log "Duplicated
// imports …, one ignored". Keeping it a sibling means the dir scan sees only the leaf source files.

export { useAutoApiList, useAutoApiGet, useAutoApiInfinite } from './composables/useAutoApiQuery'
export { useAutoApiCreate, useAutoApiUpdate, useAutoApiDelete, useAutoApiOptimisticUpdate, useAutoApiMutation } from './composables/useAutoApiMutation'
export { useAutoApiAggregate } from './composables/useAutoApiAggregate'
export { useAutoApiBulkCreate, useAutoApiBulkUpdate, useAutoApiBulkDelete } from './composables/useAutoApiBulk'
export { usePermissions, useAllPermissions } from './composables/usePermissions'
export { useM2MRelation } from './composables/useM2MRelation'
export { useM2MAdd } from './composables/useM2MAdd'
export { useM2MRemove } from './composables/useM2MRemove'
export { useM2MSync } from './composables/useM2MSync'
export { useM2MBatchSync } from './composables/useM2MBatchSync'
export { useAutoApiToast } from './composables/useAutoApiToast'
export { useAutoApiEndpointMutation, useAutoApiEndpointQuery } from './composables/useAutoApiEndpoint'
export { invalidateAutoApiResource } from './composables/useAutoApiMutation'
export { useAutoApiPath } from './composables/autoApiPath'

// Types the composables return — exported here so consumers (and their declaration emit) can name them.
export type { ListQueryParams, ListResponse, GetResponse } from './composables/useAutoApiQuery'
export type { AggregateOptions, AggregateResponse } from './composables/useAutoApiAggregate'
export type { AutoApiMutationOptions } from './composables/mutationHandlers'
export type {
  PermissionCheckResult,
  PermissionQueryResponse,
  BulkOperationResponse,
  M2MListQuery,
  M2MListResponse,
  M2MOperationResponse,
  M2MAddRequest,
  M2MRemoveRequest,
  M2MSyncRequest,
  M2MBatchSyncRequest,
  M2MBatchSyncResponse,
} from './types'
export type { AutoApiToastOptions, ToastProvider } from './types/toast'
