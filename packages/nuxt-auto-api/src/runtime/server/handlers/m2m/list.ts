import { and, eq, inArray } from 'drizzle-orm'
import type { HandlerContext, M2MListResponse, M2MListQuery } from '../../../types'
import { buildWhereClause, parseFilterParam } from '../../utils/buildWhereClause'
import { buildOrderBy } from '../../utils/buildOrderBy'
import { filterFields } from '../../utils/filterFields'
import { filterHiddenFields } from '../../utils/filterHiddenFields'
import { filterReadableFields } from '../../utils/fieldPermissions'
import { readableColumns } from '../../utils/queryFields'
import { contextFor, passesObjectLevel, rowScope } from '../../utils/rowAccess'
import { serializeResponse } from '../../utils/serializeResponse'
import { primaryKeyColumn, primaryKeyName } from '../../utils/table'
import { selectInChunks } from '../../utils/atomicWrites'
import { m2mPrelude } from './shared'

const truthy = (v: unknown) => v === true || v === 'true' || v === '1'

/**
 * GET /api/{resource}/:id/relations/:relation
 *
 * Linked ids (and with `?includeRecords=true` the related rows) — only rows of the related resource the
 * caller may see. `filter` / `sort` / `fields` apply to the related rows and may only name its readable
 * columns. `limit` defaults to and is capped by `pagination.maxLimit`.
 */
export async function m2mListHandler(context: HandlerContext): Promise<M2MListResponse> {
  const side = await m2mPrelude(context, 'list')
  const q = (context.validated.query || context.query) as M2MListQuery & Record<string, any>
  const { junction, relatedTable, relation } = side
  const rel = contextFor(context, relation)

  const maxLimit = (context.runtimeConfig as any)?.autoApi?.pagination?.maxLimit ?? 100
  const limit = Math.min(Math.max(Number(q.limit) || maxLimit, 1), maxLimit)
  const offset = Math.max(Number(q.offset) || 0, 0)

  const readable = await readableColumns(context, relation, relatedTable)
  const conditions: any[] = [
    inArray(
      primaryKeyColumn(relatedTable),
      context.db.select({ id: junction.table[junction.rightKey] }).from(junction.table).where(eq(junction.table[junction.leftKey], side.leftId)),
    ),
  ]
  const scope = rowScope(context, relation, relatedTable)
  if (scope) conditions.push(scope)
  const filterWhere = buildWhereClause(parseFilterParam(q.filter), relatedTable, readable)
  if (filterWhere) conditions.push(filterWhere)

  const orderBy = buildOrderBy(q.sort as any, relatedTable, readable)
  let query = context.db.select().from(relatedTable).where(and(...conditions))
  query = query.orderBy(...(orderBy.length ? orderBy : [primaryKeyColumn(relatedTable)]))
  const fetched: any[] = await query.limit(limit + 1).offset(offset)

  const hasMore = fetched.length > limit
  const visible: any[] = []
  for (const row of fetched.slice(0, limit)) {
    if (await passesObjectLevel(context, relation, row)) visible.push(row)
  }

  const pk = primaryKeyName(relatedTable)
  const ids = visible.map(r => r[pk])
  const response: M2MListResponse = { ids, total: ids.length, meta: { limit, offset, hasMore } }

  if (truthy(q.includeRecords)) {
    let records: any = filterHiddenFields(visible, rel)
    records = await filterReadableFields(records, rel)
    if (q.fields) records = filterFields(records, q.fields as any)
    response.records = serializeResponse(records)
  }

  if (truthy(q.includeMetadata) && junction.metadataColumns.length > 0 && ids.length > 0) {
    const junctionRows = await selectInChunks(ids, part => context.db.select().from(junction.table).where(and(
      eq(junction.table[junction.leftKey], side.leftId),
      inArray(junction.table[junction.rightKey], part),
    )))
    const byId = new Map(junctionRows.map(r => [String(r[junction.rightKey]), r]))
    response.metadata = ids.map((id) => {
      const row = byId.get(String(id)) ?? {}
      return Object.fromEntries(junction.metadataColumns.filter(c => c in row).map(c => [c, row[c]]))
    })
  }
  return response
}
