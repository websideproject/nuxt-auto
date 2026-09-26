// Re-exports types only. Do NOT import column builders from here — pick the dialect subpath:
//   @websideproject/nuxt-auto-api/schema/sqlite
//   @websideproject/nuxt-auto-api/schema/pg
//   @websideproject/nuxt-auto-api/schema/mysql
export type { IdOpts, TenantOpts, SoftDeleteOpts, SoftDeletePreset, TenantPreset } from './shared'
export { COL } from './shared'
