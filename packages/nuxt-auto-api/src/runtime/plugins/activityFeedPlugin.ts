import { desc, eq } from 'drizzle-orm'
import { defineEventHandler, getQuery, createError } from 'h3'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface ActivityFeedPluginOptions {
  /** Drizzle table name for activities. @default 'activities' */
  table?: string
  /** Resources to track. @default '*' (all) */
  resources?: string[] | '*'
  /** Message template. Placeholders: {user.name}, {user.email}, {user.id}, {operation}, {resource} */
  template?: string
}

const DEFAULT_TEMPLATE = '{user.email} {operation}d a {resource}'

function formatMessage(template: string, vars: Record<string, any>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const parts = key.split('.')
    let val: any = vars
    for (const p of parts) {
      val = val?.[p]
    }
    return val ?? key
  })
}

const OPERATION_LABELS: Record<string, string> = {
  create: 'create',
  update: 'update',
  delete: 'delete',
}

/**
 * Create an activity feed plugin.
 * Maintains a user-facing activity feed of changes across resources.
 *
 * @example
 * ```ts
 * createActivityFeedPlugin({
 *   table: 'activities',
 *   resources: ['articles', 'comments'],
 *   template: '{user.email} {operation}d a {resource}',
 * })
 * ```
 */
export function createActivityFeedPlugin(options: ActivityFeedPluginOptions = {}): AutoApiPlugin {
  const {
    table: activityTable = 'activities',
    resources = '*',
    template = DEFAULT_TEMPLATE,
  } = options

  function shouldTrack(resource: string): boolean {
    if (resources === '*') return true
    return resources.includes(resource)
  }

  async function writeActivity(
    db: any,
    schema: any,
    entry: {
      resource: string
      operation: string
      recordId: string | number
      userId?: string | number | null
      message: string
    },
  ) {
    const table = schema[activityTable]
    if (!table) {
      console.warn(`[autoApi:activity] Activity table "${activityTable}" not found in schema. Skipping.`)
      return
    }

    try {
      await db.insert(table).values({
        resource: entry.resource,
        operation: entry.operation,
        recordId: String(entry.recordId),
        userId: entry.userId ? String(entry.userId) : null,
        message: entry.message,
        timestamp: new Date(),
      })
    } catch (err) {
      console.error('[autoApi:activity] Failed to write activity:', err)
    }
  }

  return defineAutoApiPlugin({
    name: 'activity-feed',
    version: '1.0.0',
    buildSetup(ctx) {
      ctx.addServerHandler({
        route: '/api/activities',
        method: 'get',
        handler: defineEventHandler(async (event) => {
          const { registry } = await (import('#nuxt-auto-api-registry') as any)
          const { getDatabaseAdapter } = await import('../server/database')

          const adapter = getDatabaseAdapter()
          const db = adapter.db
          const schema: Record<string, any> = {}
          for (const [name, config] of Object.entries(registry)) {
            schema[name] = (config as any).schema
          }

          const table = schema[activityTable]
          if (!table) {
            throw createError({ statusCode: 500, message: 'Activity table not configured' })
          }

          const query = getQuery(event)
          const limit = Math.min(Number(query.limit) || 50, 200)
          const offset = Number(query.offset) || 0

          let queryBuilder = db.select().from(table)

          if (query.resource) {
            queryBuilder = queryBuilder.where(eq(table.resource, query.resource as string))
          }
          if (query.userId) {
            queryBuilder = queryBuilder.where(eq(table.userId, String(query.userId)))
          }

          const data = await queryBuilder
            .orderBy(desc(table.timestamp))
            .limit(limit)
            .offset(offset)

          return { data, meta: { limit, offset } }
        }),
      })
    },
    runtimeSetup(ctx) {
      ctx.addGlobalHook({
        afterCreate(result, context) {
          if (!shouldTrack(context.resource)) return
          const message = formatMessage(template, {
            user: context.user || { id: 'system', email: 'system' },
            operation: OPERATION_LABELS.create,
            resource: context.resource,
          })
          writeActivity(context.db, context.schema, {
            resource: context.resource,
            operation: 'create',
            recordId: result?.id,
            userId: context.user?.id,
            message,
          })
        },

        afterUpdate(result, context) {
          if (!shouldTrack(context.resource)) return
          const message = formatMessage(template, {
            user: context.user || { id: 'system', email: 'system' },
            operation: OPERATION_LABELS.update,
            resource: context.resource,
          })
          writeActivity(context.db, context.schema, {
            resource: context.resource,
            operation: 'update',
            recordId: result?.id,
            userId: context.user?.id,
            message,
          })
        },

        afterDelete(id, context) {
          if (!shouldTrack(context.resource)) return
          const message = formatMessage(template, {
            user: context.user || { id: 'system', email: 'system' },
            operation: OPERATION_LABELS.delete,
            resource: context.resource,
          })
          writeActivity(context.db, context.schema, {
            resource: context.resource,
            operation: 'delete',
            recordId: id!,
            userId: context.user?.id,
            message,
          })
        },
      })

      ctx.logger.info(`Activity feed enabled for: ${resources === '*' ? 'all resources' : (resources as string[]).join(', ')}`)
    },
  })
}
