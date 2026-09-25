import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { findAuthorizedRow } from '../utils/rowAccess'
import { canViewSoftDeleted } from '../utils/softDelete'
import { executeBeforeHook, executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { assertWritableFields, filterReadableFields } from '../utils/fieldPermissions'
import { parseJsonColumns } from '../utils/parseJsonColumns'
import { protectedFieldsFor, stripProtectedFields } from '../utils/protectedFields'
import { updateReturning } from '../utils/returning'
import { serializeResponse } from '../utils/serializeResponse'
import { hasColumn, primaryKeyName } from '../utils/table'

/**
 * Prepare one update body: drop server-owned columns (primary key, tenant, soft-delete, audit, createdAt)
 * and refuse fields the caller may not write. Shared with bulk update.
 */
export async function prepareUpdateData(context: HandlerContext, table: any, body: any): Promise<Record<string, any>> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, message: 'Request body must be an object' })
  }
  const data = stripProtectedFields(body, protectedFieldsFor(context, context.resource, table, 'update'))
  await assertWritableFields(data, context)
  return data
}

/** `updatedAt` stamp for tables that have the column. */
export function withUpdatedAt(table: any, data: Record<string, any>): Record<string, any> {
  if (hasColumn(table, 'updatedAt')) return { ...data, updatedAt: new Date() }
  if (hasColumn(table, 'updated_at')) return { ...data, updated_at: new Date() }
  return data
}

/**
 * Update handler - PATCH /api/[resource]/[id]
 *
 * The row must be visible to the caller (tenant, listFilter, not trashed — trashed rows come back through
 * `/restore`) and pass `objectLevel`.
 */
export async function updateHandler(context: HandlerContext): Promise<SingleResponse> {
  const { db, schema, params, resource } = context
  const table = schema[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
  if (!params.id) throw createError({ statusCode: 400, message: 'ID parameter is required' })

  const existing = await findAuthorizedRow(context, resource, params.id, {
    softDeleted: (await canViewSoftDeleted(context)) ? 'include' : 'exclude',
  })
  const id = existing[primaryKeyName(table)]

  let data = await prepareUpdateData(context, table, context.validated.body)
  data = await executeBeforeHook('update', context, data, id)

  // A body made only of server-owned columns changes nothing (and an empty SET is invalid SQL).
  const updated = Object.keys(data).length === 0
    ? existing
    : await updateReturning(db, table, id, withUpdatedAt(table, data))
  if (!updated) throw createError({ statusCode: 404, message: `${resource} with id ${params.id} not found` })

  const parsed = parseJsonColumns(updated, context)
  const result = await executeAfterHookWithTransform('update', context, parsed)
  let out: any = filterHiddenFields(result, context)
  out = await filterReadableFields(out, context)
  return { data: serializeResponse(out) }
}
