import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import type { HandlerContext, M2MBatchSyncRequest, M2MBatchSyncResponse } from '../../../types'
import { detectJunction, validateJunctionConfig } from '../../utils/m2m/detectJunction'
import { validateResourceExists, validateBatchSize, validateMetadata, sanitizeIds } from '../../utils/m2m/validateM2M'
import { buildM2MPermissionContext, checkM2MPermissions } from '../../utils/m2m/permissions'
import { executeBatchM2MWithChunking, getCurrentRelations, calculateDiff } from '../../utils/m2m/batchOperations'

/**
 * Batch sync multiple M2M relations in a single transaction
 * POST /api/{resource}/{id}/relations/batch
 */
export async function m2mBatchHandler(context: HandlerContext): Promise<M2MBatchSyncResponse> {
  const { db, schema, params, event, resource } = context

  // Get parameters
  const leftId = params.id

  if (!leftId) {
    throw createError({
      statusCode: 400,
      message: 'Resource ID is required',
    })
  }

  // Parse and validate request body
  const body = await readBody(event) as M2MBatchSyncRequest

  if (!body || typeof body !== 'object' || !body.relations) {
    throw createError({
      statusCode: 400,
      message: 'Request body must include "relations" object',
    })
  }

  const { relations } = body

  if (typeof relations !== 'object' || Object.keys(relations).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'relations must be a non-empty object',
    })
  }

  // Validate each relation
  for (const [relationName, relationData] of Object.entries(relations)) {
    if (!Array.isArray(relationData.ids)) {
      throw createError({
        statusCode: 400,
        message: `relations.${relationName}.ids must be an array`,
      })
    }

    validateResourceExists(schema, relationName)

    if (relationData.ids.length > 0) {
      validateBatchSize(relationData.ids)
    }
  }

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

  // Execute all operations in a single transaction
  const result = await db.transaction(async (tx: any) => {
    const results: M2MBatchSyncResponse['results'] = {}

    for (const [relationName, relationData] of Object.entries(relations)) {
      try {
        // Detect junction table
        const junction = detectJunction(schema, resource, relationName)
        validateJunctionConfig(junction, schema)

        // Validate metadata if provided
        if (relationData.metadata) {
          validateMetadata(relationData.metadata, junction)
        }

        // Sanitize IDs
        const sanitizedIds = sanitizeIds(relationData.ids)

        // Verify related records exist (if IDs provided)
        if (sanitizedIds.length > 0) {
          const relatedTable = schema[relationName]
          const { inArray } = await import('drizzle-orm')
          const rightRecords = await tx
            .select()
            .from(relatedTable)
            .where(inArray(relatedTable.id, sanitizedIds))

          if (rightRecords.length !== sanitizedIds.length) {
            const foundIds = rightRecords.map((r: any) => r.id)
            const missingIds = sanitizedIds.filter(id => !foundIds.includes(id))
            throw createError({
              statusCode: 404,
              message: `Some ${relationName} not found: ${missingIds.join(', ')}`,
            })
          }

          // Check M2M permissions for this relation
          const permissionContext = buildM2MPermissionContext(context, {
            relation: relationName,
            relationResource: relationName,
            ids: sanitizedIds,
            metadata: relationData.metadata,
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
        }

        // Get current relations and calculate diff
        const currentIds = await getCurrentRelations(tx, junction, parsedLeftId)
        const { toAdd, toRemove } = calculateDiff(currentIds, sanitizedIds)

        // Execute batch operation (use tx instead of db)
        const opResult = await executeBatchM2MWithChunking(
          tx,
          junction,
          parsedLeftId,
          {
            toAdd,
            toRemove,
            metadata: relationData.metadata,
          }
        )

        results[relationName] = {
          added: opResult.added,
          removed: opResult.removed,
          total: opResult.total,
        }
      } catch (error: any) {
        // Store error for this relation
        results[relationName] = {
          added: 0,
          removed: 0,
          total: 0,
          error: error.message || 'Unknown error',
        }

        // Re-throw to rollback transaction
        throw error
      }
    }

    return results
  })

  return {
    success: true,
    results: result,
  }
}
