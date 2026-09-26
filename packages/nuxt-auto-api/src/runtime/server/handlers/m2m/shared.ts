import { createError } from 'h3'
import type { DetectedJunction, HandlerContext, M2MPermissionConfig } from '../../../types'
import { detectJunction, validateJunctionConfig } from '../../utils/m2m/detectJunction'
import { buildM2MPermissionContext, checkCustomM2MPermission } from '../../utils/m2m/permissions'
import { sanitizeIds, validateBatchSize, validateMetadata } from '../../utils/m2m/validateM2M'
import { assertPermission } from '../../utils/permissions'
import { getAuthConfig } from '../../utils/authConfig'
import { contextFor, findAuthorizedRow, findAuthorizedRows } from '../../utils/rowAccess'
import { primaryKeyName } from '../../utils/table'

export type M2MOperation = 'list' | 'sync' | 'add' | 'remove'

export interface M2MSide {
  relation: string
  junction: DetectedJunction
  leftRecord: any
  leftId: string | number
  relatedTable: any
  m2mConfig?: M2MPermissionConfig
}

/**
 * Everything an M2M route checks before touching the junction table:
 *
 *  - the relation is a registered resource with a junction to this one
 *  - LEFT: the caller may `read` (list) or `update` (writes) this resource, and the row is visible to them
 *    (tenant, listFilter, not trashed, objectLevel) — otherwise 404/403
 *  - RIGHT: the caller may `read` the related resource (`update` when `permissions.m2m.requireUpdateToLink`
 *    or `requireUpdateOnRelated` names it)
 *
 * Permissions are checked before any row is looked up, so a denied caller learns nothing about existence.
 */
export async function m2mPrelude(context: HandlerContext, operation: M2MOperation, relationName = context.params.relation): Promise<M2MSide> {
  const { resource, params, schema } = context
  if (!params.id) throw createError({ statusCode: 400, message: 'Resource ID is required' })
  if (!relationName) throw createError({ statusCode: 400, message: 'Relation name is required' })
  if (!context.registry?.[relationName] || !schema[relationName]) {
    throw createError({ statusCode: 404, message: `Unknown relation '${relationName}'` })
  }

  const leftAuth = getAuthConfig(context, resource)
  await assertPermission(operation === 'list' ? 'read' : 'update', leftAuth, context, resource)

  const m2mConfig = leftAuth?.permissions?.m2m
  const requireUpdate = !!(m2mConfig?.requireUpdateToLink || m2mConfig?.requireUpdateOnRelated?.includes(relationName))
  const rightContext = contextFor(context, relationName)
  await assertPermission(operation !== 'list' && requireUpdate ? 'update' : 'read', getAuthConfig(context, relationName), rightContext, relationName)

  // The junction does not have to be a registered resource (that would expose CRUD routes for it): look in
  // the full Drizzle schema too.
  const tables = { ...(context.db?._?.fullSchema ?? {}), ...schema }
  const explicit = (context.runtimeConfig as any)?.autoApi?.m2m?.relations?.[resource]?.[relationName]
  const junction = detectJunction(tables, resource, relationName, explicit?.junctionTable, explicit?.leftKey, explicit?.rightKey)
  validateJunctionConfig(junction, tables)

  const leftRecord = await findAuthorizedRow(context, resource, params.id)
  return {
    relation: relationName,
    junction,
    leftRecord,
    leftId: leftRecord[primaryKeyName(schema[resource])],
    relatedTable: schema[relationName],
    m2mConfig,
  }
}

/**
 * Load the related rows for `ids`, requiring every one to be visible to the caller. Invisible and missing
 * ids are reported the same way (404), so linking cannot be used to discover rows.
 */
export async function authorizeRelatedIds(context: HandlerContext, side: M2MSide, rawIds: Array<string | number>): Promise<{ ids: Array<string | number>, records: any[] }> {
  validateBatchSize(rawIds)
  const ids = [...new Map(sanitizeIds(rawIds).map(id => [String(id), id])).values()]
  if (ids.length === 0) return { ids, records: [] }
  const records = await findAuthorizedRows(context, side.relation, ids)
  const pk = primaryKeyName(side.relatedTable)
  const found = new Set(records.map(r => String(r[pk])))
  const missing = ids.filter(id => !found.has(String(id)))
  if (missing.length) throw createError({ statusCode: 404, message: `Some ${side.relation} not found: ${missing.join(', ')}` })
  // Keep the caller's order (metadata is matched to ids by position).
  return { ids, records }
}

/** Metadata aligned to `ids` (by id), from the request's parallel `ids` / `metadata` arrays. */
export function alignMetadata(rawIds: Array<string | number>, metadata: Array<Record<string, any>> | undefined, ids: Array<string | number>) {
  if (!metadata) return undefined
  const byId = new Map<string, Record<string, any>>()
  rawIds.forEach((id, i) => {
    if (!byId.has(String(id))) byId.set(String(id), metadata[i]!)
  })
  return ids.map(id => byId.get(String(id)) ?? {})
}

export function validateM2MMetadata(metadata: any, side: M2MSide): void {
  if (metadata !== undefined) validateMetadata(metadata, side.junction)
}

export async function runCustomM2MCheck(
  context: HandlerContext,
  side: M2MSide,
  operation: M2MOperation,
  ids: Array<string | number>,
  records: any[],
  metadata?: Array<Record<string, any>>,
): Promise<void> {
  await checkCustomM2MPermission(buildM2MPermissionContext(context, {
    relation: side.relation,
    relationResource: side.relation,
    ids,
    metadata,
    junction: { tableName: side.junction.tableName, leftKey: side.junction.leftKey, rightKey: side.junction.rightKey },
    leftRecord: side.leftRecord,
    rightRecords: records,
    operation,
  }), side.m2mConfig, side.relation)
}
