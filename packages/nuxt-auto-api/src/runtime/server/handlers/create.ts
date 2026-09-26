import { createError } from 'h3'
import type { HandlerContext, SingleResponse } from '../../types'
import { executeBeforeHook, executeAfterHookWithTransform } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { assertWritableFields, filterReadableFields } from '../utils/fieldPermissions'
import { parseJsonColumns } from '../utils/parseJsonColumns'
import { protectedFieldsFor, stripProtectedFields } from '../utils/protectedFields'
import { insertReturning } from '../utils/returning'
import { serializeResponse } from '../utils/serializeResponse'
import { tenantWriteField } from '../utils/tenant'

/**
 * Prepare one create body: drop server-owned columns, stamp the tenant, refuse fields the caller may not
 * write. Shared with bulk create.
 */
export async function prepareCreateData(context: HandlerContext, table: any, body: any): Promise<Record<string, any>> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, message: 'Request body must be an object' })
  }
  const data: Record<string, any> = stripProtectedFields(body, protectedFieldsFor(context, context.resource, table, 'create'))

  const tenantKey = tenantWriteField(context, context.resource, table)
  if (tenantKey && !(context.tenant!.canAccessAllTenants && data[tenantKey] != null)) {
    data[tenantKey] = context.tenant!.id
  }

  // The write gate is on what the CALLER asked for — before hooks, which write on the server's behalf.
  await assertWritableFields(data, context)
  return data
}

/**
 * Create handler - POST /api/[resource]
 */
export async function createHandler(context: HandlerContext): Promise<SingleResponse> {
  const { db, schema, resource } = context
  const table = schema[resource]
  if (!table) throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })

  let data = await prepareCreateData(context, table, context.validated.body)
  data = await executeBeforeHook('create', context, data)

  const [created] = await insertReturning(db, table, data)
  if (!created) throw createError({ statusCode: 500, message: 'Failed to create record' })

  const parsed = parseJsonColumns(created, context)
  const result = await executeAfterHookWithTransform('create', context, parsed)
  let out: any = filterHiddenFields(result, context)
  out = await filterReadableFields(out, context)
  return { data: serializeResponse(out) }
}
