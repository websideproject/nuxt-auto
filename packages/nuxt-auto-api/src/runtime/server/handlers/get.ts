import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { authorizeIncluded, planIncludes } from '../utils/includes'
import { passesObjectLevel, rowScope } from '../utils/rowAccess'
import { coerceId, primaryKeyColumn } from '../utils/table'
import { executeBeforeHook, executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterFields } from '../utils/filterFields'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { filterReadableFields } from '../utils/fieldPermissions'
import { parseJsonColumns } from '../utils/parseJsonColumns'
import { serializeResponse } from '../utils/serializeResponse'
import { canViewSoftDeleted } from '../utils/softDelete'

/**
 * Get single handler - GET /api/[resource]/[id]
 *
 * A row outside the caller's visibility (tenant, listFilter, soft delete) is a 404; a visible row that
 * fails `objectLevel` is a 403. A trashed row is returned to callers who may view trash.
 */
export async function getHandler(context: HandlerContext): Promise<SingleResponse> {
  const { db, schema, params, query, validated, resource } = context
  const table = schema[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })

  const id = params.id
  if (!id) throw createError({ statusCode: 400, message: 'ID parameter is required' })

  await executeBeforeHook('get', context, undefined, id)

  const q = validated.query || query
  const includes = await planIncludes(context, resource, q.include as any)

  const idCondition = eq(primaryKeyColumn(table), coerceId(table, id, resource))
  // A trashed row is visible by id to callers who may view trash (no flag needed — one row cannot widen).
  const scope = rowScope(context, resource, table, { softDeleted: (await canViewSoftDeleted(context)) ? 'include' : 'exclude' })
  const where = scope ? and(idCondition, scope) : idCondition

  let data: any
  if (includes) {
    data = await db.query[includes.queryKey].findFirst({ where, with: includes.with })
  }
  else {
    const [row] = await db.select().from(table).where(where).limit(1)
    data = row
  }

  if (!data) throw createError({ statusCode: 404, message: `${resource} with id ${id} not found` })
  if (!(await passesObjectLevel(context, resource, data))) {
    throw createError({ statusCode: 403, message: 'Forbidden: you don\'t have permission to access this object' })
  }

  data = await authorizeIncluded(context, data, includes)
  data = parseJsonColumns(data, context)
  let out: any = filterHiddenFields(data, context)
  out = await filterReadableFields(out, context)
  if (q.fields) out = filterFields(out, q.fields as any)
  out = await executeAfterHookWithTransform('get', context, out)

  return { data: serializeResponse(out) }
}
