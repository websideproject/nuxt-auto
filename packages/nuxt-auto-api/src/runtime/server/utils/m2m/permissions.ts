import { createError } from 'h3'
import type { HandlerContext, M2MPermissionConfig, M2MPermissionContext } from '../../../types'

/**
 * The context handed to a custom M2M check (`permissions.m2m.relations[relation].check`).
 */
export function buildM2MPermissionContext(
  handlerContext: HandlerContext,
  params: {
    relation: string
    relationResource: string
    ids: Array<string | number>
    metadata?: Array<Record<string, any>>
    junction: { tableName: string, leftKey: string, rightKey: string }
    leftRecord?: any
    rightRecords?: any[]
    operation: M2MPermissionContext['operation']
  },
): M2MPermissionContext {
  return {
    left: { resource: handlerContext.resource, id: handlerContext.params.id!, record: params.leftRecord },
    right: { resource: params.relationResource, ids: params.ids, records: params.rightRecords },
    junction: {
      table: params.junction.tableName,
      leftKey: params.junction.leftKey,
      rightKey: params.junction.rightKey,
      metadata: params.metadata,
    },
    operation: params.operation,
    user: handlerContext.user,
    permissions: handlerContext.permissions,
    handlerContext,
    db: handlerContext.db,
    schema: handlerContext.schema,
  }
}

/**
 * Run the resource's custom M2M check for this relation, if one is declared. A falsy result, or a thrown
 * error without a status, is a 403.
 *
 * `permissions.m2m` is keyed by RELATION name everywhere (`requireUpdateOnRelated`, `relations[name]`) — the
 * `:relation` segment of the route, which is also the related resource's registered name.
 */
export async function checkCustomM2MPermission(context: M2MPermissionContext, m2mConfig: M2MPermissionConfig | undefined, relation: string): Promise<void> {
  const check = m2mConfig?.relations?.[relation]?.check
  if (!check) return
  let allowed: boolean
  try {
    allowed = await check(context)
  }
  catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 403, message: error?.message || 'Custom M2M permission check failed' })
  }
  if (!allowed) {
    throw createError({ statusCode: 403, message: `Custom M2M permission check failed for ${context.left.resource} -> ${context.right.resource}` })
  }
}
