import { and, count } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, ListResponse } from '../../types'
import { buildWhereClause, parseFilterParam } from '../utils/buildWhereClause'
import { parseSort, toOrderBy } from '../utils/buildOrderBy'
import { buildPagination } from '../utils/buildPagination'
import { buildCursorWhere, cursorOrder, encodeCursor } from '../utils/cursor'
import { canViewSoftDeleted } from '../utils/softDelete'
import { rowScope } from '../utils/rowAccess'
import { readableColumns, assertQueryField } from '../utils/queryFields'
import { authorizeIncluded, planIncludes } from '../utils/includes'
import { parseAggregateParam, executeSimpleAggregation, validateAggregation } from '../utils/buildAggregation'
import { executeAfterHookWithTransform, executeBeforeHook } from '../utils/executeHooks'
import { filterFields } from '../utils/filterFields'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { filterReadableFields } from '../utils/fieldPermissions'
import { parseJsonColumns } from '../utils/parseJsonColumns'
import { serializeResponse } from '../utils/serializeResponse'

const truthy = (v: unknown) => v === true || v === 'true' || v === '1'

/**
 * Soft-delete mode for a read: live rows only, unless the caller asks for trash AND may view it.
 */
export async function softDeleteModeFor(context: HandlerContext, query: Record<string, any>): Promise<'exclude' | 'include' | 'only'> {
  const only = truthy(query.onlyDeleted)
  const include = truthy(query.includeDeleted)
  if (!only && !include) return 'exclude'
  if (!(await canViewSoftDeleted(context))) return 'exclude'
  return only ? 'only' : 'include'
}

/**
 * List handler - GET /api/[resource]
 */
export async function listHandler(context: HandlerContext): Promise<ListResponse> {
  const { db, schema, query, validated, resource } = context
  const table = schema[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })

  const q = validated.query || query
  await executeBeforeHook('list', context)

  const readable = await readableColumns(context, resource, table)

  // WHERE: the caller's filter (readable columns only) AND row visibility AND plugin filters.
  const conditions: any[] = []
  const filterWhere = buildWhereClause(parseFilterParam(q.filter), table, readable)
  if (filterWhere) conditions.push(filterWhere)
  const scope = rowScope(context, resource, table, { softDeleted: await softDeleteModeFor(context, q) })
  if (scope) conditions.push(scope)
  for (const extra of context.additionalFilters ?? []) conditions.push(extra)
  const baseWhere = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)

  const sort = parseSort(q.sort as any, table, readable)
  const pagination = buildPagination(q, (context.runtimeConfig as any)?.autoApi?.pagination)
  const includes = await planIncludes(context, resource, q.include as any)

  // Cursor pagination: `?cursor=` (empty for the first page). Order = sort + primary key.
  const useCursor = q.cursor !== undefined
  const order = useCursor ? cursorOrder(sort, table) : sort
  let where = baseWhere
  if (useCursor && q.cursor) {
    const cursorWhere = buildCursorWhere(table, String(q.cursor), order)
    where = where ? and(where, cursorWhere) : cursorWhere
  }
  const orderBy = toOrderBy(order, table)

  const objectLevel = context.objectLevelCheck
  const fetchBatch = async (limit: number | undefined, offset: number | undefined): Promise<any[]> => {
    if (includes) {
      return await db.query[includes.queryKey].findMany({
        ...(where ? { where } : {}),
        ...(orderBy.length ? { orderBy } : {}),
        ...(limit ? { limit } : {}),
        ...(offset ? { offset } : {}),
        with: includes.with,
      })
    }
    let qb = db.select().from(table)
    if (where) qb = qb.where(where)
    if (orderBy.length) qb = qb.orderBy(...orderBy)
    if (limit) qb = qb.limit(limit)
    if (offset) qb = qb.offset(offset)
    return await qb
  }

  const pageSize = pagination.limit
  const fetchLimit = useCursor ? pageSize + 1 : pageSize
  const firstOffset = useCursor ? undefined : pagination.offset
  let data = await fetchBatch(fetchLimit, firstOffset)

  // objectLevel is a per-row function: keep fetching until the page is full or the data runs out.
  if (objectLevel) {
    const target = fetchLimit
    const kept: any[] = []
    let batch = data
    let offset = (firstOffset || 0) + batch.length
    for (let i = 0; i < 20; i++) {
      for (const row of batch) {
        if (await objectLevel(row, context)) kept.push(row)
        if (kept.length >= target) break
      }
      if (kept.length >= target || batch.length < target) break
      batch = await fetchBatch(target, offset)
      if (batch.length === 0) break
      offset += batch.length
    }
    data = kept
  }

  let hasMore = false
  let nextCursor: string | undefined
  if (useCursor) {
    hasMore = data.length > pageSize
    if (hasMore) data = data.slice(0, pageSize)
    if (hasMore && data.length) nextCursor = encodeCursor(data[data.length - 1], order)
  }

  // Total (offset pagination). With an objectLevel check the SQL count cannot know which rows the
  // function would drop, so no total is reported rather than a wrong one.
  let total: number | undefined
  if (q.page !== undefined && !objectLevel) {
    let countQuery = db.select({ count: count() }).from(table)
    if (baseWhere) countQuery = countQuery.where(baseWhere)
    const [row] = await countQuery
    total = Number(row?.count ?? 0)
  }

  data = await authorizeIncluded(context, data, includes)
  data = parseJsonColumns(data, context)
  let out: any = filterHiddenFields(data, context)
  out = await filterReadableFields(out, context)
  if (q.fields) out = filterFields(out, q.fields as any)

  let aggregates: Record<string, any> | undefined
  if (q.aggregate) {
    if (q.groupBy) throw createError({ statusCode: 400, message: 'Grouped aggregations use GET /{resource}/aggregate' })
    const list = parseAggregateParam(String(q.aggregate))
    const check = validateAggregation(list, undefined, context)
    if (!check.valid) throw createError({ statusCode: 400, message: check.error || 'Invalid aggregation' })
    for (const a of list) if (a.field && a.field !== '*') assertQueryField(a.field, readable, 'aggregate')
    aggregates = await executeSimpleAggregation(db, table, list, baseWhere)
  }

  out = await executeAfterHookWithTransform('list', context, out)

  const response: ListResponse = { data: serializeResponse(out), meta: { limit: pageSize } }
  if (aggregates) response.meta.aggregates = serializeResponse(aggregates)
  if (useCursor) {
    response.meta.hasMore = hasMore
    if (nextCursor) response.meta.nextCursor = nextCursor
  }
  else if (q.page !== undefined) {
    response.meta.page = Number(q.page)
    if (total !== undefined) response.meta.total = total
  }
  return response
}
