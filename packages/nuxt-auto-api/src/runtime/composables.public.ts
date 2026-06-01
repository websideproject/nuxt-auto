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
