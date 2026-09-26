import { and, inArray } from 'drizzle-orm'
import type { HandlerContext, PermissionQueryResponse, RecordPermissions } from '../../types'
import { getResourcePermissions } from '../utils/permissions'
import { contextFor, rowScope } from '../utils/rowAccess'
import { selectInChunks } from '../utils/atomicWrites'
import { coerceId, primaryKeyColumn, primaryKeyName } from '../utils/table'

const DENIED: RecordPermissions = { canRead: false, canUpdate: false, canDelete: false }

/**
 * GET /api/{resource}/permissions — what the caller may do, evaluated exactly as the gates enforce it
 * (the merged nuxt.config override, deny by default).
 *
 * `?ids=1,2,3` adds `records`: per row, the resource permission AND the row being visible to the caller AND the
 * resource's `objectLevel` rule for that operation — what a UI needs to enable Edit / Delete on one row. A row the
 * caller cannot see answers like one that does not exist (all `false`), so existence is not disclosed.
 */
export async function permissionsHandler(context: HandlerContext): Promise<PermissionQueryResponse> {
  const permissions = await getResourcePermissions(context.effectiveAuth, context)
  const raw = (context.query as any)?.ids
  const ids = [...new Set((Array.isArray(raw) ? raw : String(raw ?? '').split(',')).map(String).map(s => s.trim()).filter(Boolean))]
  if (ids.length === 0) return { ...permissions, resource: context.resource, user: context.user }

  const maxIds = (context.runtimeConfig as any)?.autoApi?.pagination?.maxLimit ?? 100
  const records: Record<string, RecordPermissions> = {}
  for (const id of ids.slice(0, maxIds)) records[id] = DENIED
  if (!permissions.canRead) return { ...permissions, resource: context.resource, user: context.user, records }

  const { resource } = context
  const table = context.schema[resource]
  const pk = primaryKeyName(table)
  const scope = rowScope(context, resource, table)
  const coerced = Object.keys(records).flatMap((id) => {
    try {
      return [coerceId(table, id, resource)]
    }
    catch {
      return [] // an id that can never match (e.g. text for a numeric key) stays denied
    }
  })
  const rows = await selectInChunks(coerced, part => context.db.select().from(table)
    .where(scope ? and(inArray(primaryKeyColumn(table), part), scope) : inArray(primaryKeyColumn(table), part)))

  const objectLevel = context.effectiveAuth?.objectLevel
  const allowed = async (row: any, operation: 'get' | 'update' | 'delete', granted: boolean) =>
    granted && (!objectLevel || !!(await objectLevel(row, { ...contextFor(context, resource), operation })))
  for (const row of rows) {
    records[String(row[pk])] = {
      canRead: await allowed(row, 'get', permissions.canRead),
      canUpdate: await allowed(row, 'update', permissions.canUpdate),
      canDelete: await allowed(row, 'delete', permissions.canDelete),
    }
  }
  return { ...permissions, resource: context.resource, user: context.user, records }
}
