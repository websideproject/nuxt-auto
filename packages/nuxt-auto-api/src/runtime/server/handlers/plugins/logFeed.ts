import { createError, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { authorizedContext } from '../../utils/pluginRoutes'
import { parseFilterParam } from '../../utils/buildWhereClause'
import { hasColumn, primaryKeyName } from '../../utils/table'
import { listHandler } from '../list'

/**
 * The audit-log and activity-feed routes: a list of the log table — a registered resource — through its own
 * authorization (`read` permission, tenant, listFilter, hidden fields), newest first. `resource`, `recordId` and
 * `userId` are shorthands for `filter`; `limit`, `page` and `cursor` page as on any list.
 */
export async function logFeed(event: H3Event, table: string | undefined) {
  if (!table) throw createError({ statusCode: 500, message: 'Log table not configured' })
  const context = await authorizedContext(event, table, 'list')
  const q = getQuery(event)
  const shorthand: Record<string, string> = {}
  for (const key of ['resource', 'recordId', 'userId']) if (q[key] !== undefined) shorthand[key] = String(q[key])
  const base = (context.validated.query ?? context.query) as Record<string, any>
  const filter = parseFilterParam(base.filter) ?? {}
  // Newest first. The key breaks ties: timestamps are often whole seconds, and a create and the update right
  // after it would otherwise come back in either order.
  const logTable = context.schema[table]
  const pk = primaryKeyName(logTable)
  const newestFirst = hasColumn(logTable, 'timestamp') ? { sort: hasColumn(logTable, pk) ? `-timestamp,-${pk}` : '-timestamp' } : {}
  context.validated = { ...context.validated, query: { ...newestFirst, ...base, filter: { ...filter, ...shorthand } } }
  return listHandler(context)
}
