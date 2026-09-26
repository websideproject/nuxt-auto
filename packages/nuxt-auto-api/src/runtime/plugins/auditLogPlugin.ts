import { eq } from 'drizzle-orm'
import { pluginFromFactory } from '../types/plugin'
import { registerPluginRoutes } from './pluginRoutes'
import type { AutoApiPlugin } from '../types/plugin'

export interface AuditLogPluginOptions {
  /** Drizzle table name for audit logs. @default 'auditLogs' */
  table?: string
  /** Resources to audit. @default '*' (all) */
  resources?: string[] | '*'
  /**
   * Fields excluded from every resource's before/after snapshots.
   * Use this for fields that are sensitive across the board (e.g. 'password').
   */
  excludeFields?: string[]
  /**
   * Per-resource field exclusions, merged on top of `excludeFields`.
   * Use this when the same field name is sensitive in one resource but not another.
   *
   * @example
   * excludeFieldsByResource: {
   *   apiKeys:  ['key'],        // strip the hash — redundant with global but explicit
   *   webhooks: ['secret'],     // strip encrypted secret
   *   users:    ['internalNotes'],  // sensitive in users, fine in other resources
   * }
   */
  excludeFieldsByResource?: Record<string, string[]>
  /** Fire-and-forget writes (don't await the insert). @default true */
  async?: boolean
}

function stripFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') return obj
  const result = { ...obj }
  for (const field of fields) {
    Reflect.deleteProperty(result, field)
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
    excludeFieldsByResource = {},
    async: fireAndForget = true,
  } = options

  function shouldAudit(resource: string): boolean {
    if (resources === '*') return true
    return resources.includes(resource)
  }

  function fieldsFor(resource: string): string[] {
    const extra = excludeFieldsByResource[resource]
    return extra?.length ? [...excludeFields, ...extra] : excludeFields
  }

  async function writeAuditLog(
    db: any,
    schema: any,
    entry: {
      resource: string
      operation: string
      recordId: string | number
      userId?: string | number | null
      authMethod?: string | null
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

    const fields = fieldsFor(entry.resource)
    const before = entry.before ? stripFields(entry.before, fields) : null
    const after = entry.after ? stripFields(entry.after, fields) : null

    const values: Record<string, any> = {
      resource: entry.resource,
      operation: entry.operation,
      recordId: String(entry.recordId),
      userId: entry.userId ? String(entry.userId) : null,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      ip: entry.ip || null,
      timestamp: new Date(),
    }

    // authMethod column is optional — only written if the table has the column
    if ('authMethod' in table) {
      values.authMethod = entry.authMethod ?? null
    }

    try {
      await db.insert(table).values(values)
    }
    catch (err) {
      console.error('[autoApi:audit] Failed to write audit log:', err)
    }
  }

  return pluginFromFactory('createAuditLogPlugin', [options], {
    name: 'audit-log',
    version: '1.0.0',
    buildSetup(ctx) {
      // GET /api/audit-logs — the log table's list, through its own authorization (handlers/plugins/auditLogs.ts)
      registerPluginRoutes(ctx, 'auditLog', { table: auditTable }, [{ path: '/audit-logs', method: 'get', handler: 'auditLogs' }])
    },
    runtimeSetup(ctx) {
      ctx.addGlobalHook({
        async beforeUpdate(id, _data, context) {
          if (!shouldAudit(context.resource)) return
          // Snapshot current state for diff
          const table = context.schema[context.resource]
          if (table) {
            const parsedId = /^\d+$/.test(String(id)) ? Number.parseInt(String(id), 10) : id
            const [current] = await context.db.select().from(table).where(eq(table.id, parsedId))
            ;(context as any)._auditBefore = current || null
          }
        },

        async beforeDelete(id, context) {
          if (!shouldAudit(context.resource)) return
          const table = context.schema[context.resource]
          if (table) {
            const parsedId = /^\d+$/.test(String(id)) ? Number.parseInt(String(id), 10) : id
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
            authMethod: (context as any).authMethod ?? null,
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
            authMethod: (context as any).authMethod ?? null,
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
            authMethod: (context as any).authMethod ?? null,
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
