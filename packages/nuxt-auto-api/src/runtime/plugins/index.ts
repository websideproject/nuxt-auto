export { createRateLimitPlugin, InMemoryRateLimitStore } from './rateLimitPlugin'
export type { RateLimitPluginOptions, RateLimitStore, RateLimitLimiter } from './rateLimitPlugin'
export { createBetterAuthPlugin } from './betterAuthPlugin'
export type { BetterAuthPluginOptions } from './betterAuthPlugin'
export { createRequestMetadataPlugin } from './requestMetadataPlugin'
export type {
  RequestMetadataPluginOptions,
  MetadataMapper,
  JsonFieldConfig,
} from './requestMetadataPlugin'
export { createAuditLogPlugin } from './auditLogPlugin'
export type { AuditLogPluginOptions } from './auditLogPlugin'
export { createWebhookPlugin } from './webhookPlugin'
export type { WebhookPluginOptions, WebhookEndpoint } from './webhookPlugin'
export { createActivityFeedPlugin } from './activityFeedPlugin'
export type { ActivityFeedPluginOptions } from './activityFeedPlugin'
export { createSlugPlugin } from './slugPlugin'
export type { SlugPluginOptions } from './slugPlugin'
export { createSchemaValidationPlugin } from './schemaValidationPlugin'
export type { SchemaValidationPluginOptions } from './schemaValidationPlugin'
export { createExportPlugin } from './exportPlugin'
export type { ExportPluginOptions } from './exportPlugin'
export { createFileUploadPlugin } from './fileUploadPlugin'
export type { FileUploadPluginOptions, FileUploadResourceConfig } from './fileUploadPlugin'
export { createRevisionPlugin } from './revisionPlugin'
export type { RevisionPluginOptions } from './revisionPlugin'
export { createCachePlugin, InMemoryCacheStore } from './cachePlugin'
export type { CachePluginOptions, CacheStore } from './cachePlugin'
export { createSearchPlugin } from './searchPlugin'
export type { SearchPluginOptions } from './searchPlugin'
export { createEncryptionPlugin } from './encryptionPlugin'
export type { EncryptionPluginOptions } from './encryptionPlugin'
export { createApiTokenPlugin } from './apiTokenPlugin'
export type { ApiTokenPluginOptions, ApiTokenResourceConfig } from './apiTokenPlugin'
export { createAuditStampPlugin } from './auditStampPlugin'
export { defineAutoApiPlugin } from '../types/plugin'
export type { AutoApiPlugin, PluginBuildContext, PluginRuntimeContext, AutoApiMiddleware, ContextExtender } from '../types/plugin'
export type { PermissionEvaluator, PermissionObject, PermissionFunction, HandlerContext, ResourceAuthConfig } from '../types'
// Register a structured-permission evaluator or a per-request context extender from anywhere
// (e.g. a Nitro server plugin), not just the plugin runtime context. The registry is global, so
// these are callable at server startup. A context extender runs once per request before
// authorization and can attach data/resolvers onto the handler context (auto-api never inspects it).
export { registerPermissionEvaluator, getPermissionEvaluators, addContextExtender } from '../server/plugins/pluginRegistry'
