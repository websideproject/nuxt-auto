import { pluginFromFactory } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'
import { registerPluginRoutes } from './pluginRoutes'

export interface FileUploadResourceConfig {
  /** Database column to store the file URL */
  field: string
  /** Max file size (e.g., '2mb', '5mb'). @default '5mb' */
  maxSize?: string
  /** Accepted MIME types (e.g., ['image/*', 'application/pdf']) */
  accept?: string[]
  /** Storage subdirectory path. @default resource name */
  path?: string
}

export interface FileUploadPluginOptions {
  /** Storage backend. @default 'local' */
  storage: 'local' | 'nuxthub-blob'
  /** Per-resource upload config */
  resources: Record<string, FileUploadResourceConfig>
  /** Base directory for local storage. @default 'server/uploads' */
  localDir?: string
}

/**
 * Create a file upload plugin.
 * Handles file uploads tied to resource records.
 *
 * @example
 * ```ts
 * createFileUploadPlugin({
 *   storage: 'local',
 *   resources: {
 *     users: { field: 'avatarUrl', maxSize: '2mb', accept: ['image/*'] },
 *     articles: { field: 'coverImage', maxSize: '5mb', accept: ['image/*'] },
 *   },
 * })
 * ```
 */
export function createFileUploadPlugin(options: FileUploadPluginOptions): AutoApiPlugin {
  const {
    storage,
    resources,
    localDir = 'server/uploads',
  } = options

  return pluginFromFactory('createFileUploadPlugin', [options], {
    name: 'file-upload',
    version: '1.0.0',
    buildSetup(ctx) {
      // POST / DELETE /api/:resource/:id/upload — an authorized update of the record (handlers/plugins/upload.ts)
      const names = Object.keys(resources)
      registerPluginRoutes(ctx, 'fileUpload', { storage, resources, localDir }, [], [
        { path: '/:id/upload', method: 'post', handler: 'upload', resources: names },
        { path: '/:id/upload', method: 'delete', handler: 'upload', resources: names },
      ])
    },
    runtimeSetup(ctx) {
      // Cleanup files on record deletion
      ctx.addGlobalHook({
        async afterDelete(id, context) {
          const config = resources[context.resource]
          if (!config) return

          // The record is already deleted, so we can't query for the file URL
          // beforeDelete should have stashed it (handled by audit plugin or similar)
          // For standalone use, we skip file cleanup on delete
          // (the file becomes orphaned but this is safer than pre-fetching in every delete)
        },
      })

      ctx.logger.info(`File upload enabled for: ${Object.keys(resources).join(', ')} (storage: ${storage})`)
    },
  })
}
