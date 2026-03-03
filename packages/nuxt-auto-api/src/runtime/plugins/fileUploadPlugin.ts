import { defineEventHandler, readMultipartFormData, createError, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

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

function parseSize(size: string): number {
  const match = size.match(/^(\d+)(kb|mb|gb)$/i)
  if (!match) return 5 * 1024 * 1024 // default 5mb
  const num = match[1]
  const unit = match[2]
  const multipliers: Record<string, number> = { kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }
  return parseInt(num!) * (multipliers[unit!.toLowerCase()] || 1024 * 1024)
}

function matchesMime(type: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern === '*' || pattern === '*/*') return true
    if (pattern.endsWith('/*')) {
      return type.startsWith(pattern.replace('/*', '/'))
    }
    return type === pattern
  })
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

  return defineAutoApiPlugin({
    name: 'file-upload',
    version: '1.0.0',
    buildSetup(ctx) {
      for (const [resource, config] of Object.entries(resources)) {
        const maxSizeBytes = parseSize(config.maxSize || '5mb')
        const storagePath = config.path || resource

        // Upload endpoint
        ctx.addServerHandler({
          route: `/api/${resource}/:id/upload`,
          method: 'post',
          handler: defineEventHandler(async (event) => {
            const id = getRouterParam(event, 'id')
            if (!id) {
              throw createError({ statusCode: 400, message: 'ID is required' })
            }

            const { registry } = await (import('#nuxt-auto-api-registry') as any)
            const { getDatabaseAdapter } = await import('../server/database')

            const resourceConfig = (registry as any)[resource]
            if (!resourceConfig) {
              throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
            }

            const adapter = getDatabaseAdapter()
            const db = adapter.db
            const table = resourceConfig.schema

            // Check record exists
            const parsedId = /^\d+$/.test(id) ? parseInt(id, 10) : id
            const [existing] = await db.select().from(table).where(eq(table.id, parsedId))
            if (!existing) {
              throw createError({ statusCode: 404, message: 'Record not found' })
            }

            // Read multipart form data
            const formData = await readMultipartFormData(event)
            if (!formData || formData.length === 0) {
              throw createError({ statusCode: 400, message: 'No file uploaded' })
            }

            const file = formData[0]!
            if (!file.data || !file.filename) {
              throw createError({ statusCode: 400, message: 'Invalid file data' })
            }

            const fileData = file.data
            const fileName = file.filename
            const fileType = file.type

            // Validate size
            if (fileData.length > maxSizeBytes) {
              throw createError({ statusCode: 413, message: `File too large. Max: ${config.maxSize || '5mb'}` })
            }

            // Validate type
            if (config.accept && fileType) {
              if (!matchesMime(fileType, config.accept)) {
                throw createError({ statusCode: 415, message: `File type not accepted. Allowed: ${config.accept.join(', ')}` })
              }
            }

            // Generate unique filename
            const ext = fileName.split('.').pop() || 'bin'
            const uniqueName = `${id}-${Date.now()}.${ext}`
            let fileUrl: string

            if (storage === 'local') {
              const dir = join(process.cwd(), localDir, storagePath)
              await mkdir(dir, { recursive: true })
              const filePath = join(dir, uniqueName)
              await writeFile(filePath, fileData)
              fileUrl = `/uploads/${storagePath}/${uniqueName}`
            } else {
              // NuxtHub Blob storage
              try {
                const { hubBlob } = await import('#imports' as any)
                const blob = await hubBlob().put(uniqueName, fileData, {
                  prefix: storagePath,
                  contentType: fileType,
                })
                fileUrl = blob.pathname || blob.url
              } catch (err) {
                throw createError({ statusCode: 500, message: 'Blob storage not available' })
              }
            }

            // Update DB record
            const [updated] = await db
              .update(table)
              .set({ [config.field]: fileUrl })
              .where(eq(table.id, parsedId))
              .returning()

            return { data: updated }
          }),
        })

        // Delete upload endpoint
        ctx.addServerHandler({
          route: `/api/${resource}/:id/upload`,
          method: 'delete',
          handler: defineEventHandler(async (event) => {
            const id = getRouterParam(event, 'id')
            if (!id) {
              throw createError({ statusCode: 400, message: 'ID is required' })
            }

            const { registry } = await (import('#nuxt-auto-api-registry') as any)
            const { getDatabaseAdapter } = await import('../server/database')

            const resourceConfig = (registry as any)[resource]
            if (!resourceConfig) {
              throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
            }

            const adapter = getDatabaseAdapter()
            const db = adapter.db
            const table = resourceConfig.schema

            const parsedId = /^\d+$/.test(id) ? parseInt(id, 10) : id
            const [existing] = await db.select().from(table).where(eq(table.id, parsedId))
            if (!existing) {
              throw createError({ statusCode: 404, message: 'Record not found' })
            }

            const currentUrl = existing[config.field]

            // Remove file from storage
            if (currentUrl && storage === 'local') {
              try {
                const filePath = join(process.cwd(), localDir, currentUrl.replace('/uploads/', ''))
                await unlink(filePath)
              } catch {
                // File may not exist
              }
            }

            // Clear DB field
            const [updated] = await db
              .update(table)
              .set({ [config.field]: null })
              .where(eq(table.id, parsedId))
              .returning()

            return { data: updated }
          }),
        })
      }
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
