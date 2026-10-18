// `@websideproject/nuxt-auto-api/rules` — the authorization evaluators, without Nitro.
//
// `/utils` re-exports these too, but it also carries handlers and helpers that import `nitropack/runtime`, which
// only loads inside a Nitro build. Everything here (and everything it imports) runs in plain Node, so rules can be
// unit-tested in Vitest without a stub. test/unit/rulesSubpath.test.ts keeps it that way.

export { evaluatePermission, resolvePermission, checkPermission, assertPermission, checkFieldPermission, getResourcePermissions } from './utils/permissions'
export type { PermissionOperation } from './utils/permissions'
export { getAuthConfig, mergeAuthConfig } from './utils/authConfig'
export { rowScope, passesObjectLevel, contextFor } from './utils/rowAccess'
export { tenantCondition, resolveTenant, isTenantScoped } from './utils/tenant'
export { deniedWriteFields, assertWritableFields, filterReadableFields } from './utils/fieldPermissions'
export { registerPermissionEvaluator } from './plugins/pluginRegistry'
