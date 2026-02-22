import { eq, desc, and, count } from 'drizzle-orm'
import { defineEventHandler, getQuery, getRouterParam, createError, readBody } from 'h3'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface RevisionPluginOptions {
  /** Resources to track revisions for (undefined = all) */
  resources?: string[]
  /** Maximum revisions to keep per record. @default 50 */
  maxRevisionsPerRecord?: number
  /** Drizzle table name for revisions. @default 'revisions' */
  table?: string
}

/**
 * Create a revision history plugin.
 * Stores full snapshots of records on every update, with list and restore endpoints.
 *
 * @example
 * ```ts
 * createRevisionPlugin({
 *   resources: ['articles', 'pages'],
 *   maxRevisionsPerRecord: 50,
 *   table: 'revisions',
 * })
 * ```
 */
export function createRevisionPlugin(options: RevisionPluginOptions = {}): AutoApiPlugin {
  const {
    resources,
    maxRevisionsPerRecord = 50,
    table: revisionTable = 'revisions',
  } = options

  function shouldTrack(resource: string): boolean {
    if (!resources) return true
    return resources.includes(resource)
  }

  return defineAutoApiPlugin({
    name: 'revision-history',
    version: '1.0.0',
    buildSetup(ctx) {
      // List revisions endpoint: GET /api/:resource/:id/revisions
      ctx.addServerHandler({
        route: '/api/:resource/:id/revisions',
        method: 'get',
        handler: defineEventHandler(async (event) => {
          const resource = getRouterParam(event, 'resource')
          const recordId = getRouterParam(event, 'id')

          if (!resource || !recordId) {
            throw createError({ statusCode: 400, message: 'Resource and ID are required' })
          }

          if (resources && !resources.includes(resource)) {
            throw createError({ statusCode: 403, message: `Revisions not enabled for ${resource}` })
          }

          const { registry } = await (import('#nuxt-auto-api-registry') as any)
          const { getDatabaseAdapter } = await import('../server/database')

          const adapter = getDatabaseAdapter()
          const db = adapter.db
          const schema: Record<string, any> = {}
          for (const [name, config] of Object.entries(registry)) {
            schema[name] = (config as any).schema
          }

          const table = schema[revisionTable]
          if (!table) {
            throw createError({ statusCode: 500, message: 'Revisions table not configured' })
          }

          const query = getQuery(event)
          const limit = Math.min(Number(query.limit) || 20, 100)
          const offset = Number(query.offset) || 0

          const data = await db
            .select()
            .from(table)
            .where(and(
              eq(table.resource, resource),
              eq(table.recordId, String(recordId)),
            ))
            .orderBy(desc(table.version))
            .limit(limit)
            .offset(offset)

          return { data, meta: { limit, offset } }
        }),
      })

      // Restore revision endpoint: POST /api/:resource/:id/revisions/:version/restore
      ctx.addServerHandler({
        route: '/api/:resource/:id/revisions/:version/restore',
        method: 'post',
        handler: defineEventHandler(async (event) => {
          const resource = getRouterParam(event, 'resource')
          const recordId = getRouterParam(event, 'id')
          const version = getRouterParam(event, 'version')

          if (!resource || !recordId || !version) {
            throw createError({ statusCode: 400, message: 'Resource, ID, and version are required' })
          }

          if (resources && !resources.includes(resource)) {
            throw createError({ statusCode: 403, message: `Revisions not enabled for ${resource}` })
          }

          const { registry } = await (import('#nuxt-auto-api-registry') as any)
          const { getDatabaseAdapter } = await import('../server/database')

          const adapter = getDatabaseAdapter()
          const db = adapter.db
          const schema: Record<string, any> = {}
          for (const [name, config] of Object.entries(registry)) {
            schema[name] = (config as any).schema
          }

          const revTable = schema[revisionTable]
          if (!revTable) {
            throw createError({ statusCode: 500, message: 'Revisions table not configured' })
          }

          // Find the revision
          const [revision] = await db
            .select()
            .from(revTable)
            .where(and(
              eq(revTable.resource, resource),
              eq(revTable.recordId, String(recordId)),
              eq(revTable.version, parseInt(version, 10)),
            ))

          if (!revision) {
            throw createError({ statusCode: 404, message: `Revision v${version} not found` })
          }

          // Parse snapshot data
          const snapshotData = typeof revision.data === 'string' ? JSON.parse(revision.data) : revision.data

          // Update the resource record (this will trigger a new revision via hooks)
          const resourceTable = schema[resource]
          if (!resourceTable) {
            throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
          }

          const parsedId = /^\d+$/.test(recordId) ? parseInt(recordId, 10) : recordId
          const { id: _id, createdAt: _createdAt, ...restoreData } = snapshotData

          const [updated] = await db
            .update(resourceTable)
            .set({ ...restoreData, updatedAt: new Date() })
            .where(eq(resourceTable.id, parsedId))
            .returning()

          if (!updated) {
            throw createError({ statusCode: 404, message: 'Record not found' })
          }

          return { data: updated, meta: { restoredFromVersion: parseInt(version, 10) } }
        }),
      })
    },
    runtimeSetup(ctx) {
      ctx.addGlobalHook({
        async beforeUpdate(id, _data, context) {
          if (!shouldTrack(context.resource)) return

          // Snapshot current state before the update
          const table = context.schema[context.resource]
          if (!table) return

          const parsedId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : id
          const [current] = await context.db.select().from(table).where(eq(table.id, parsedId))
          ;(context as any)._revisionBefore = current || null
        },

        async afterUpdate(_result, context) {
          if (!shouldTrack(context.resource)) return

          const beforeData = (context as any)._revisionBefore
          if (!beforeData) return

          const revTable = context.schema[revisionTable]
          if (!revTable) {
            console.warn(`[autoApi:revision] Revision table "${revisionTable}" not found in schema.`)
            return
          }

          try {
            // Get latest version number
            const [latestRow] = await context.db
              .select({ maxVersion: revTable.version })
              .from(revTable)
              .where(and(
                eq(revTable.resource, context.resource),
                eq(revTable.recordId, String(beforeData.id)),
              ))
              .orderBy(desc(revTable.version))
              .limit(1)

            const nextVersion = (latestRow?.maxVersion || 0) + 1

            // Insert revision
            await context.db.insert(revTable).values({
              resource: context.resource,
              recordId: String(beforeData.id),
              version: nextVersion,
              data: JSON.stringify(beforeData),
              userId: context.user?.id ? String(context.user.id) : null,
              timestamp: new Date(),
            })

            // Enforce max revisions per record
            if (maxRevisionsPerRecord > 0) {
              const [countResult] = await context.db
                .select({ total: count() })
                .from(revTable)
                .where(and(
                  eq(revTable.resource, context.resource),
                  eq(revTable.recordId, String(beforeData.id)),
                ))

              if (countResult?.total > maxRevisionsPerRecord) {
                // Get the oldest revisions to delete
                const toDelete = await context.db
                  .select({ id: revTable.id })
                  .from(revTable)
                  .where(and(
                    eq(revTable.resource, context.resource),
                    eq(revTable.recordId, String(beforeData.id)),
                  ))
                  .orderBy(revTable.version)
                  .limit(countResult.total - maxRevisionsPerRecord)

                for (const row of toDelete) {
                  await context.db.delete(revTable).where(eq(revTable.id, row.id))
                }
              }
            }
          } catch (err) {
            console.error('[autoApi:revision] Failed to create revision:', err)
          }
        },
      })

      ctx.logger.info(`Revision history enabled for: ${resources?.join(', ') || 'all resources'} (max ${maxRevisionsPerRecord}/record)`)
    },
  })
}
