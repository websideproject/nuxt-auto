import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import type { HandlerContext, M2MOperationResponse, M2MRemoveRequest } from '../../../types'
import { detectJunction, validateJunctionConfig } from '../../utils/m2m/detectJunction'
import { validateM2MRemoveRequest, validateResourceExists, validateIdsNotEmpty, validateBatchSize, sanitizeIds } from '../../utils/m2m/validateM2M'
import { buildM2MPermissionContext, checkM2MPermissions } from '../../utils/m2m/permissions'
import { executeBatchM2MWithChunking } from '../../utils/m2m/batchOperations'
import { executeBeforeHook, executeAfterHook } from '../../utils/executeHooks'

/**
 * Remove M2M relations handler
 * DELETE /api/{resource}/{id}/relations/{relation}/remove
 */
export async function m2mRemoveHandler(context: HandlerContext): Promise<M2MOperationResponse> {
  const { db, schema, params, event, resource } = context

  // Get parameters
  const leftId = params.id
  const relation = params.relation

  if (!leftId) {
    throw createError({
      statusCode: 400,
      message: 'Resource ID is required',
    })
  }

  if (!relation) {
    throw createError({
      statusCode: 400,
      message: 'Relation name is required',
    })
  }

  // Parse and validate request body
  const body = context.validated?.body || await readBody(event)
  const validation = validateM2MRemoveRequest(body)

  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      message: validation.error,
    })
  }

  const { ids } = validation.data!

  // Validate resource exists
  validateResourceExists(schema, relation)

  // Validate IDs
  validateIdsNotEmpty(ids)
  validateBatchSize(ids)

  // Detect junction table
  const junction = detectJunction(schema, resource, relation)
  validateJunctionConfig(junction, schema)

  // Sanitize IDs (convert numeric strings to numbers)
  const sanitizedIds = sanitizeIds(ids)
  const parsedLeftId = /^\d+$/.test(leftId) ? parseInt(leftId, 10) : leftId

  // Verify left record exists
  const leftTable = schema[resource]
  const [leftRecord] = await db
    .select()
    .from(leftTable)
    .where(eq(leftTable.id, parsedLeftId))
    .limit(1)

  if (!leftRecord) {
    throw createError({
      statusCode: 404,
      message: `${resource} with id ${leftId} not found`,
    })
  }

  // Note: We don't need to verify related records exist for removal
  // (they might have been deleted already)

  // Check M2M permissions
  const permissionContext = buildM2MPermissionContext(context, {
    relation,
    relationResource: relation,
    ids: sanitizedIds,
    junction: {
      tableName: junction.tableName,
      leftKey: junction.leftKey,
      rightKey: junction.rightKey,
    },
    leftRecord,
    operation: 'remove',
  })

  await checkM2MPermissions(permissionContext)

  // Execute beforeM2MRemove hook
  await executeBeforeHook('m2mRemove', context, relation, sanitizedIds)

  // Execute batch operation (only remove, no add)
  const result = await executeBatchM2MWithChunking(
    db,
    junction,
    parsedLeftId,
    {
      toAdd: [],
      toRemove: sanitizedIds,
    }
  )

  // Build response
  const response: M2MOperationResponse = {
    success: true,
    removed: result.removed,
    total: result.total,
  }

  // Execute afterM2MRemove hook
  await executeAfterHook('m2mRemove', context, relation, response)

  return response
}
