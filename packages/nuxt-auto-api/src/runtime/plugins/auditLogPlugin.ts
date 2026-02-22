import { eq, desc } from 'drizzle-orm'
import { defineEventHandler, getQuery, createError } from 'h3'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface AuditLogPluginOptions {
  /** Drizzle table name for audit logs. @default 'auditLogs' */
  table?: string
  /** Resources to audit. @default '*' (all) */
  resources?: string[] | '*'
  /** Fields to exclude from audit snapshots (e.g., ['password']) */
  excludeFields?: string[]
  /** Fire-and-forget writes (don't await the insert). @default true */
  async?: boolean
}

function stripFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') return obj
  const result = { ...obj }
  for (const field of fields) {
    delete result[field]
  }
  return result
}

/**
 * Create an audit log plugin.
 * Records every create, update, and delete operation in an audit log table.
 *
 * @example
 * ```ts
 * createAuditLogPlugin({
 *   table: 'auditLogs',
 *   resources: ['users', 'orders'],
 *   excludeFields: ['password'],
 * })
 * ```
 */
export function createAuditLogPlugin(options: AuditLogPluginOptions = {}): AutoApiPlugin {
  const {
    table: auditTable = 'auditLogs',
    resources = '*',
    excludeFields = [],
    async: fireAndForget = true,
  } = options

  function shouldAudit(resource: string): boolean {
    if (resources === '*') return true
    return resources.includes(resource)
  }

  async function writeAuditLog(
    db: any,
    schema: any,
    entry: {
      resource: string
      operation: string
      recordId: string | number
      userId?: string | number | null
      before?: any
      after?: any
      ip?: string
    },
  ) {
    const table = schema[auditTable]
    if (!table) {
      console.warn(`[autoApi:audit] Audit table "${auditTable}" not found in schema. Skipping audit log.`)
      return
    }

    const before = entry.before ? stripFields(entry.before, excludeFields) : null
    const after = entry.after ? stripFields(entry.after, excludeFields) : null

    try {
      await db.insert(table).values({
        resource: entry.resource,
        operation: entry.operation,
        recordId: String(entry.recordId),
        userId: entry.userId ? String(entry.userId) : null,
        before: before ? JSON.stringify(before) : null,
        after: after ? JSON.stringify(after) : null,
        ip: entry.ip || null,
        timestamp: new Date(),
      })
    } catch (err) {
      console.error('[autoApi:audit] Failed to write audit log:', err)
    }
  }

  return defineAutoApiPlugin({
    name: 'audit-log',
    version: '1.0.0',
    buildSetup(ctx) {
      // Register audit log query endpoint
      ctx.addServerHandler({
        route: '/api/audit-logs',
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

          const table = schema[auditTable]
          if (!table) {
            throw createError({ statusCode: 500, message: 'Audit log table not configured' })
          }

          const query = getQuery(event)
          const limit = Math.min(Number(query.limit) || 50, 200)
          const offset = Number(query.offset) || 0

          let queryBuilder = db.select().from(table)

          if (query.resource) {
            queryBuilder = queryBuilder.where(eq(table.resource, query.resource as string))
          }
          if (query.recordId) {
            queryBuilder = queryBuilder.where(eq(table.recordId, String(query.recordId)))
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
        async beforeUpdate(id, _data, context) {
          if (!shouldAudit(context.resource)) return
          // Snapshot current state for diff
          const table = context.schema[context.resource]
          if (table) {
            const parsedId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : id
            const [current] = await context.db.select().from(table).where(eq(table.id, parsedId))
            ;(context as any)._auditBefore = current || null
          }
        },

        async beforeDelete(id, context) {
          if (!shouldAudit(context.resource)) return
          const table = context.schema[context.resource]
          if (table) {
            const parsedId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : id
            const [current] = await context.db.select().from(table).where(eq(table.id, parsedId))
            ;(context as any)._auditBefore = current || null
          }
        },

        afterCreate(result, context) {
          if (!shouldAudit(context.resource)) return
          const entry = {
            resource: context.resource,
            operation: 'create',
            recordId: result?.id,
            userId: context.user?.id,
            after: result,
            ip: context.requestMeta?.ip,
          }
          const promise = writeAuditLog(context.db, context.schema, entry)
          if (!fireAndForget) return promise as any
        },

        afterUpdate(result, context) {
          if (!shouldAudit(context.resource)) return
          const entry = {
            resource: context.resource,
            operation: 'update',
            recordId: result?.id,
            userId: context.user?.id,
            before: (context as any)._auditBefore,
            after: result,
            ip: context.requestMeta?.ip,
          }
          const promise = writeAuditLog(context.db, context.schema, entry)
          if (!fireAndForget) return promise as any
        },

        afterDelete(id, context) {
          if (!shouldAudit(context.resource)) return
          const entry = {
            resource: context.resource,
            operation: 'delete',
            recordId: id!,
            userId: context.user?.id,
            before: (context as any)._auditBefore,
            ip: context.requestMeta?.ip,
          }
          const promise = writeAuditLog(context.db, context.schema, entry)
          if (!fireAndForget) return promise as any
        },
      })

      ctx.logger.info(`Audit logging enabled for: ${resources === '*' ? 'all resources' : (resources as string[]).join(', ')}`)
    },
  })
}
