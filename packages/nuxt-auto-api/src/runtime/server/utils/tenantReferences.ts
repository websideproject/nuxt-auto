import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext } from '../../types'
import { fkColKey, safeTableName, tableForeignKeys } from './softDeleteCascade'
import { tenantCondition } from './tenant'

/**
 * A write may only point at rows of the caller's own tenant. For every foreign key of `table` set in `data` whose
 * target is a tenant-scoped resource, the referenced row must be in the caller's tenant — a task cannot be filed
 * under another organization's project. A row of another tenant gets the same answer as a row that does not exist
 * (existence is not disclosed). Unscoped targets (a `users` table excluded from tenancy, an `organizations` table)
 * and callers who may access every tenant are not checked.
 *
 * Runs on what the caller sent — before hooks, which write on the server's behalf.
 */
export async function assertReferencesInTenant(context: HandlerContext, table: any, data: Record<string, any>): Promise<void> {
  const schema: Record<string, any> = context.schema ?? {}
  const errors: Array<{ path: string[], message: string }> = []

  for (const fk of tableForeignKeys(table)) {
    if (fk.columns.length !== 1 || !fk.foreignColumns?.[0]) continue
    const key = fkColKey(table, fk.columns[0])
    const value = data[key]
    if (value === undefined || value === null) continue

    const targetName = safeTableName(fk.foreignTable)
    const resource = Object.keys(schema).find(r => schema[r] === fk.foreignTable || safeTableName(schema[r]) === targetName)
    if (!resource) continue
    const target = schema[resource]
    const condition = tenantCondition(context, resource, target)
    if (!condition) continue

    const column = target[fkColKey(fk.foreignTable, fk.foreignColumns[0])] ?? fk.foreignColumns[0]
    const [row] = await context.db.select({ found: column }).from(target).where(and(eq(column, value), condition)).limit(1)
    if (!row) errors.push({ path: [key], message: `${resource} ${value} not found` })
  }

  if (errors.length) {
    throw createError({ statusCode: 400, message: errors.map(e => `${e.path[0]}: ${e.message}`).join('; '), data: { errors } })
  }
}
