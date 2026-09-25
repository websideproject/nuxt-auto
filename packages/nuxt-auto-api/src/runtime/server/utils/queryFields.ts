import { createError } from 'h3'
import type { HandlerContext } from '../../types'
import { getAuthConfig } from './authConfig'
import { checkFieldPermission } from './permissions'
import { contextFor } from './rowAccess'
import { getColumns } from './table'

/**
 * Hidden fields of ONE resource: global + `hiddenFields.resources[resource]` (nuxt.config) + the
 * registration's `hiddenFields`.
 */
export function hiddenFieldsOf(context: HandlerContext, resource: string = context.resource): Set<string> {
  const config = (context.runtimeConfig as any)?.autoApi?.hiddenFields
  const out = new Set<string>(config?.global ?? [])
  for (const f of config?.resources?.[resource] ?? []) out.add(f)
  const registered = context.registry?.[resource]?.hiddenFields
    ?? (resource === context.resource ? context.resourceConfig?.hiddenFields : undefined)
  for (const f of registered ?? []) out.add(f)
  return out
}

/**
 * Columns of `resource` the caller may READ: every column, minus hidden fields, minus fields whose
 * `fields[x].read` rule denies this caller. Anything a query can observe — filter, sort, cursor, group-by,
 * aggregate, include filters and field selection — is restricted to this set, so a column that never
 * appears in a response cannot be probed through one either.
 */
export async function readableColumns(context: HandlerContext, resource: string, table: any): Promise<Set<string>> {
  const cache: Map<string, Set<string>> = ((context as any)._readableColumns ??= new Map())
  const cached = cache.get(resource)
  if (cached) return cached

  const hidden = hiddenFieldsOf(context, resource)
  const auth = getAuthConfig(context, resource)
  const target = contextFor(context, resource)
  const out = new Set<string>()
  for (const key of Object.keys(getColumns(table))) {
    if (hidden.has(key)) continue
    if (auth?.fields?.[key]?.read !== undefined && !(await checkFieldPermission(key, 'read', auth, target))) continue
    out.add(key)
  }
  cache.set(resource, out)
  return out
}

/**
 * 400 for a field the caller may not reference. Unknown and unreadable fields get the same message, so the
 * error does not reveal that a hidden column exists.
 */
export function assertQueryField(field: string, allowed: Set<string>, where: string): void {
  if (!allowed.has(field)) {
    throw createError({ statusCode: 400, message: `Unknown field '${field}' in ${where}` })
  }
}
