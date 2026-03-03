import { createError } from 'h3'
import type { HandlerContext, M2MPermissionContext, M2MPermissionConfig, ResourceAuthConfig } from '../../../types'
import { checkPermission } from '../permissions'

/**
 * Check M2M permissions (bidirectional)
 *
 * This performs comprehensive permission checks:
 * 1. LEFT side: Requires update permission on main resource
 * 2. RIGHT side: Requires read permission on related resources (or update if configured)
 * 3. CUSTOM: Runs custom M2M permission function if provided
 */
export async function checkM2MPermissions(
  context: M2MPermissionContext
): Promise<void> {
  const { left, right, handlerContext } = context

  // Get auth configs for both resources
  const leftAuthConfig = handlerContext.registry?.[left.resource]?.authorization
  const rightAuthConfig = handlerContext.registry?.[right.resource]?.authorization

  // 1. Check LEFT side: User must have update permission on main resource
  await checkLeftSidePermission(left, handlerContext, leftAuthConfig)

  // 2. Check RIGHT side: User must have read/update permission on related resources
  await checkRightSidePermission(right, left.resource, handlerContext, rightAuthConfig, leftAuthConfig?.permissions?.m2m)

  // 3. Run custom M2M permission check if provided
  await checkCustomM2MPermission(context, leftAuthConfig?.permissions?.m2m)
}

/**
 * Check LEFT side permission (main resource)
 * User must have update permission on the main resource
 */
async function checkLeftSidePermission(
  left: M2MPermissionContext['left'],
  handlerContext: HandlerContext,
  authConfig?: ResourceAuthConfig
): Promise<void> {
  if (!authConfig?.permissions?.update) {
    // No update permission configured = allow
    return
  }

  const hasPermission = await checkPermission(
    authConfig.permissions.update,
    handlerContext
  )

  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      message: `Insufficient permissions to modify relations for ${left.resource}`,
    })
  }

  // Object-level check if record is provided
  if (left.record && authConfig.objectLevel) {
    const hasObjectLevelAccess = await authConfig.objectLevel(left.record, handlerContext)
    if (!hasObjectLevelAccess) {
      throw createError({
        statusCode: 403,
        message: `Insufficient permissions to modify this ${left.resource}`,
      })
    }
  }
}

/**
 * Check RIGHT side permission (related resources)
 * Default: User must have read permission
 * Strict: User must have update permission (configured via requireUpdateOnRelated or requireUpdateToLink)
 */
async function checkRightSidePermission(
  right: M2MPermissionContext['right'],
  leftResource: string,
  handlerContext: HandlerContext,
  rightAuthConfig?: ResourceAuthConfig,
  m2mConfig?: M2MPermissionConfig
): Promise<void> {
  if (!rightAuthConfig) {
    // No auth config = allow
    return
  }

  // Determine if update permission is required
  const requireUpdate =
    m2mConfig?.requireUpdateToLink ||
    m2mConfig?.requireUpdateOnRelated?.includes(right.resource) ||
    false

  const permissionToCheck = requireUpdate
    ? rightAuthConfig.permissions?.update
    : rightAuthConfig.permissions?.read

  if (!permissionToCheck) {
    // No permission configured = allow
    return
  }

  const hasPermission = await checkPermission(
    permissionToCheck,
    handlerContext
  )

  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      message: `Insufficient permissions to ${requireUpdate ? 'link' : 'access'} ${right.resource}`,
    })
  }

  // Object-level check for each related record if provided
  if (right.records && right.records.length > 0 && rightAuthConfig.objectLevel) {
    for (const record of right.records) {
      const hasObjectLevelAccess = await rightAuthConfig.objectLevel(record, handlerContext)
      if (!hasObjectLevelAccess) {
        throw createError({
          statusCode: 403,
          message: `Insufficient permissions to access ${right.resource} with id ${record.id}`,
        })
      }
    }
  }
}

/**
 * Run custom M2M permission check
 */
async function checkCustomM2MPermission(
  context: M2MPermissionContext,
  m2mConfig?: M2MPermissionConfig
): Promise<void> {
  if (!m2mConfig?.relations) {
    return
  }

  const relationConfig = m2mConfig.relations[context.right.resource]
  if (!relationConfig?.check) {
    return
  }

  try {
    const result = await relationConfig.check(context)
    if (!result) {
      throw createError({
        statusCode: 403,
        message: `Custom M2M permission check failed for ${context.left.resource} -> ${context.right.resource}`,
      })
    }
  } catch (error: any) {
    // Re-throw H3 errors as-is
    if (error.statusCode) {
      throw error
    }

    // Wrap other errors
    throw createError({
      statusCode: 403,
      message: error.message || 'Custom M2M permission check failed',
    })
  }
}

/**
 * Build M2M permission context
 */
export function buildM2MPermissionContext(
  handlerContext: HandlerContext,
  params: {
    relation: string
    relationResource: string
    ids: Array<string | number>
    metadata?: Array<Record<string, any>>
    junction: {
      tableName: string
      leftKey: string
      rightKey: string
    }
    leftRecord?: any
    rightRecords?: any[]
    operation: M2MPermissionContext['operation']
  }
): M2MPermissionContext {
  return {
    left: {
      resource: handlerContext.resource,
      id: handlerContext.params.id,
      record: params.leftRecord,
    },
    right: {
      resource: params.relationResource,
      ids: params.ids,
      records: params.rightRecords,
    },
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
