import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import type { HandlerContext, M2MOperationResponse, M2MSyncRequest } from '../../../types'
import { detectJunction, validateJunctionConfig } from '../../utils/m2m/detectJunction'
import { validateM2MSyncRequest, validateResourceExists, validateIdsNotEmpty, validateBatchSize, validateMetadata, sanitizeIds } from '../../utils/m2m/validateM2M'
import { buildM2MPermissionContext, checkM2MPermissions } from '../../utils/m2m/permissions'
import { executeBatchM2MWithChunking, getCurrentRelations, calculateDiff } from '../../utils/m2m/batchOperations'
import { executeBeforeHook, executeAfterHook } from '../../utils/executeHooks'

/**
 * Sync M2M relations handler (replace all relations)
 * POST /api/{resource}/{id}/relations/{relation}
 */
export async function m2mSyncHandler(context: HandlerContext): Promise<M2MOperationResponse> {
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
  const validation = validateM2MSyncRequest(body)

  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      message: validation.error,
    })
  }

  const { ids, metadata } = validation.data!

  // Validate resource exists
  validateResourceExists(schema, relation)

  // Validate IDs
  if (ids.length > 0) {
    validateIdsNotEmpty(ids)
    validateBatchSize(ids)
  }

  // Detect junction table
  const junction = detectJunction(schema, resource, relation)
  validateJunctionConfig(junction, schema)

  // Validate metadata if provided
  if (metadata) {
    validateMetadata(metadata, junction)
  }

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

  // Verify related records exist (if IDs provided)
  let rightRecords: any[] = []
  if (sanitizedIds.length > 0) {
    const relatedTable = schema[relation]
    const { inArray } = await import('drizzle-orm')
    rightRecords = await db
      .select()
      .from(relatedTable)
      .where(inArray(relatedTable.id, sanitizedIds))

    if (rightRecords.length !== sanitizedIds.length) {
      const foundIds = rightRecords.map((r: any) => r.id)
      const missingIds = sanitizedIds.filter(id => !foundIds.includes(id))
      throw createError({
        statusCode: 404,
        message: `Some ${relation} not found: ${missingIds.join(', ')}`,
      })
    }
  }

  // Check M2M permissions
  const permissionContext = buildM2MPermissionContext(context, {
    relation,
    relationResource: relation,
    ids: sanitizedIds,
    metadata,
    junction: {
      tableName: junction.tableName,
      leftKey: junction.leftKey,
      rightKey: junction.rightKey,
    },
    leftRecord,
    rightRecords,
    operation: 'sync',
  })

  await checkM2MPermissions(permissionContext)

  // Execute beforeM2MSync hook
  await executeBeforeHook('m2mSync', context, relation, sanitizedIds)

  // Get current relations and calculate diff
  const currentIds = await getCurrentRelations(db, junction, parsedLeftId)
  const { toAdd, toRemove } = calculateDiff(currentIds, sanitizedIds)

  // Execute batch operation
  const result = await executeBatchM2MWithChunking(
    db,
    junction,
    parsedLeftId,
    {
      toAdd,
      toRemove,
      metadata,
    }
  )

  // Build response
  const response: M2MOperationResponse = {
    success: true,
    added: result.added,
    removed: result.removed,
    total: result.total,
  }

  // Execute afterM2MSync hook
  await executeAfterHook('m2mSync', context, relation, response)

  return response
}
