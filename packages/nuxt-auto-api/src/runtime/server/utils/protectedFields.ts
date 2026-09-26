import type { HandlerContext } from '../../types'
import { getSoftDeleteColumn, getSoftDeleteCompanions } from './softDelete'
import { getColumns, isGeneratedPrimaryKey, primaryKeyName } from './table'
import { getTenancyConfig, isTenantScoped, tenantField } from './tenant'

const AUDIT_COLUMNS = ['createdBy', 'created_by', 'updatedBy', 'updated_by']
const CREATED_AT_COLUMNS = ['createdAt', 'created_at']

/**
 * Columns a request body may never set — the server owns them:
 *
 *  - create + update: the tenant column (scoped resources), the soft-delete marker and its companions
 *    (`deletedBy`, `deletionId`, `deletedReason`), and audit stamps (`createdBy`, `updatedBy`)
 *  - update: the primary key and `createdAt`
 *  - create: the primary key when the database generates it (auto-increment, serial, identity, SQLite's
 *    integer rowid). A client-chosen key there could be the largest integer the column holds, after which
 *    the next generated key overflows and every insert into the table fails. A text / UUID key the database
 *    does not generate stays writable, so clients can create rows with ids they made (optimistic UI).
 *  - plus the registration's own `protectedFields`
 *
 * They are **dropped** from the body, not refused: clients routinely send a whole row back on PATCH
 * (id, createdAt, …) and that must keep working. Hooks run after the drop, so a `beforeCreate` /
 * `beforeUpdate` hook can still set any of them on the server's behalf.
 *
 * A tenant set with `canAccessAllTenants` (a cross-tenant operator) may set the tenant column.
 */
export function protectedFieldsFor(
  context: HandlerContext,
  resource: string,
  table: any,
  operation: 'create' | 'update',
): Set<string> {
  const columns = getColumns(table)
  const out = new Set<string>()
  const add = (key: string) => {
    if (key in columns) out.add(key)
  }

  const softCol = getSoftDeleteColumn(table)
  if (softCol) {
    out.add(softCol)
    for (const c of getSoftDeleteCompanions(table)) out.add(c)
  }
  AUDIT_COLUMNS.forEach(add)

  const config = getTenancyConfig(context)
  const tenantKey = context.tenant?.field ?? tenantField(config)
  const tenantScoped = config?.enabled ? isTenantScoped(resource, table, config) : !!context.tenant
  if (tenantScoped && !context.tenant?.canAccessAllTenants) add(tenantKey)

  if (operation === 'update') {
    add(primaryKeyName(table))
    CREATED_AT_COLUMNS.forEach(add)
  }
  else if (isGeneratedPrimaryKey(table)) {
    add(primaryKeyName(table))
  }

  const declared = context.registry?.[resource]?.protectedFields
    ?? (resource === context.resource ? context.resourceConfig?.protectedFields : undefined)
  for (const f of declared ?? []) out.add(f)
  return out
}

/** A copy of `data` without the protected columns. */
export function stripProtectedFields<T extends Record<string, any>>(data: T, fields: Set<string>): T {
  if (!data || typeof data !== 'object' || fields.size === 0) return data
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!fields.has(key)) out[key] = value
  }
  return out as T
}
