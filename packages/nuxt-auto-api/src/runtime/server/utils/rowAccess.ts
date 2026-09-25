import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext } from '../../types'
import { getAuthConfig } from './authConfig'
import { getSoftDeleteColumn } from './softDelete'
import { tenantCondition } from './tenant'
import { coerceId, primaryKeyColumn, primaryKeyName } from './table'

/**
 * Row visibility — the ONE definition of "which rows of a resource may this caller touch".
 *
 * Every generated route goes through it: list, get, update, delete, restore, bulk, aggregate, M2M (both
 * sides) and `?include=`. It combines:
 *
 *  - the tenant condition (multi-tenancy, fails closed),
 *  - the resource's `listFilter` (despite the name, it scopes EVERY access, not only lists — a row a
 *    caller cannot list is a row they cannot fetch, change or delete by id either),
 *  - soft-delete visibility.
 *
 * `objectLevel` is a per-row function and is applied after the fetch (`findAuthorizedRow`).
 */

export type SoftDeleteMode = 'exclude' | 'include' | 'only'

/** A context whose `resource` is `resource`, for evaluating another resource's rules (include, M2M). */
export function contextFor(context: HandlerContext, resource: string): HandlerContext {
  if (resource === context.resource) return context
  return {
    ...context,
    resource,
    resourceConfig: context.registry?.[resource],
    effectiveAuth: getAuthConfig(context, resource),
    objectLevelCheck: undefined,
    listFilter: undefined,
  }
}

export function rowScope(
  context: HandlerContext,
  resource: string,
  table: any,
  opts: { softDeleted?: SoftDeleteMode } = {},
): SQL | undefined {
  const conditions: SQL[] = []

  const tenant = tenantCondition(context, resource, table)
  if (tenant) conditions.push(tenant)

  const target = contextFor(context, resource)
  const listFilter = (resource === context.resource && context.listFilter) || getAuthConfig(context, resource)?.listFilter
  if (listFilter) {
    const condition = listFilter(table, target)
    if (condition) conditions.push(condition)
  }

  const softCol = getSoftDeleteColumn(table)
  const mode = opts.softDeleted ?? 'exclude'
  if (softCol && mode === 'exclude') conditions.push(isNull(table[softCol]))
  if (softCol && mode === 'only') conditions.push(isNotNull(table[softCol]))

  if (conditions.length === 0) return undefined
  return conditions.length === 1 ? conditions[0] : and(...conditions)
}

/** Run a resource's `objectLevel` check (if any) against one row. */
export async function passesObjectLevel(context: HandlerContext, resource: string, row: any): Promise<boolean> {
  const check = resource === context.resource
    ? (context.objectLevelCheck ?? getAuthConfig(context, resource)?.objectLevel)
    : getAuthConfig(context, resource)?.objectLevel
  if (!check) return true
  return !!(await check(row, contextFor(context, resource)))
}

/**
 * Fetch one row by primary key, applying row visibility. A row the caller may not see is a 404 (the same
 * answer as a row that does not exist — existence is not disclosed); a visible row that fails the
 * `objectLevel` check is a 403.
 */
export async function findAuthorizedRow(
  context: HandlerContext,
  resource: string,
  id: string | number,
  opts: { softDeleted?: SoftDeleteMode, db?: any, table?: any } = {},
): Promise<any> {
  const table = opts.table ?? context.schema?.[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
  const db = opts.db ?? context.db

  const idCondition = eq(primaryKeyColumn(table), coerceId(table, id, resource))
  const scope = rowScope(context, resource, table, { softDeleted: opts.softDeleted })
  const [row] = await db.select().from(table).where(scope ? and(idCondition, scope) : idCondition).limit(1)

  if (!row) throw createError({ statusCode: 404, message: `${resource} with id ${id} not found` })
  if (!(await passesObjectLevel(context, resource, row))) {
    throw createError({ statusCode: 403, message: 'Forbidden: you don\'t have permission to access this object' })
  }
  return row
}

/**
 * The subset of `ids` whose rows the caller may see (row visibility + `objectLevel`), as loaded rows.
 */
export async function findAuthorizedRows(
  context: HandlerContext,
  resource: string,
  ids: Array<string | number>,
  opts: { softDeleted?: SoftDeleteMode, db?: any, table?: any } = {},
): Promise<any[]> {
  if (ids.length === 0) return []
  const table = opts.table ?? context.schema?.[resource]
  if (!table) return []
  const db = opts.db ?? context.db

  const idCondition = inArray(primaryKeyColumn(table), ids.map(id => coerceId(table, id, resource)))
  const scope = rowScope(context, resource, table, { softDeleted: opts.softDeleted })
  const rows: any[] = await db.select().from(table).where(scope ? and(idCondition, scope) : idCondition)

  const allowed: any[] = []
  for (const row of rows) {
    if (await passesObjectLevel(context, resource, row)) allowed.push(row)
  }
  return allowed
}

export { primaryKeyName }
