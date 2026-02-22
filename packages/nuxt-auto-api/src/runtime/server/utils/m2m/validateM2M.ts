import { createError } from 'h3'
import type { M2MValidationResult, M2MSyncRequest, M2MAddRequest, M2MRemoveRequest, DetectedJunction } from '../../../types'

/**
 * Validate M2M sync request
 */
export function validateM2MSyncRequest(body: any): M2MValidationResult {
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be an object',
    }
  }

  const { ids, metadata } = body as M2MSyncRequest

  // Validate IDs
  if (!Array.isArray(ids)) {
    return {
      valid: false,
      error: 'ids must be an array',
    }
  }

  if (ids.some(id => typeof id !== 'string' && typeof id !== 'number')) {
    return {
      valid: false,
      error: 'All IDs must be strings or numbers',
    }
  }

  // Validate metadata if provided
  if (metadata !== undefined) {
    if (!Array.isArray(metadata)) {
      return {
        valid: false,
        error: 'metadata must be an array',
      }
    }

    if (metadata.length !== ids.length) {
      return {
        valid: false,
        error: `metadata length (${metadata.length}) must match ids length (${ids.length})`,
      }
    }

    if (metadata.some(m => typeof m !== 'object' || m === null)) {
      return {
        valid: false,
        error: 'All metadata items must be objects',
      }
    }
  }

  return {
    valid: true,
    data: { ids, metadata },
  }
}

/**
 * Validate M2M add request
 */
export function validateM2MAddRequest(body: any): M2MValidationResult {
  // Same validation as sync (reuse)
  return validateM2MSyncRequest(body)
}

/**
 * Validate M2M remove request
 */
export function validateM2MRemoveRequest(body: any): M2MValidationResult {
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be an object',
    }
  }

  const { ids } = body as M2MRemoveRequest

  // Validate IDs
  if (!Array.isArray(ids)) {
    return {
      valid: false,
      error: 'ids must be an array',
    }
  }

  if (ids.some(id => typeof id !== 'string' && typeof id !== 'number')) {
    return {
      valid: false,
      error: 'All IDs must be strings or numbers',
    }
  }

  return {
    valid: true,
    data: { ids },
  }
}

/**
 * Validate metadata against junction table schema
 */
export function validateMetadata(
  metadata: Array<Record<string, any>> | undefined,
  junction: DetectedJunction
): void {
  if (!metadata || metadata.length === 0) {
    return
  }

  // Get all valid metadata column names
  const validColumns = junction.metadataColumns

  if (validColumns.length === 0) {
    throw createError({
      statusCode: 400,
      message: `Junction table ${junction.tableName} has no metadata columns. ` +
        `Available columns: ${junction.leftKey}, ${junction.rightKey}`,
    })
  }

  // Check each metadata object
  for (let i = 0; i < metadata.length; i++) {
    const meta = metadata[i]
    const invalidColumns = Object.keys(meta).filter(
      key => !validColumns.includes(key)
    )

    if (invalidColumns.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Invalid metadata columns at index ${i}: ${invalidColumns.join(', ')}. ` +
          `Valid columns: ${validColumns.join(', ')}`,
      })
    }
  }
}

/**
 * Validate that a resource exists in the schema
 */
export function validateResourceExists(schema: any, resourceName: string): void {
  if (!schema[resourceName]) {
    throw createError({
      statusCode: 404,
      message: `Resource ${resourceName} not found in schema`,
    })
  }
}

/**
 * Validate that IDs are not empty
 */
export function validateIdsNotEmpty(ids: Array<string | number>): void {
  if (ids.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'ids array cannot be empty',
    })
  }
}

/**
 * Validate batch size
 */
export function validateBatchSize(ids: Array<string | number>, maxSize = 500): void {
  if (ids.length > maxSize) {
    throw createError({
      statusCode: 400,
      message: `Batch size ${ids.length} exceeds maximum of ${maxSize}`,
    })
  }
}

/**
 * Sanitize IDs (convert to numbers if they're numeric strings)
 */
export function sanitizeIds(ids: Array<string | number>): Array<string | number> {
  return ids.map(id => {
    if (typeof id === 'string' && /^\d+$/.test(id)) {
      return parseInt(id, 10)
    }
    return id
  })
}
