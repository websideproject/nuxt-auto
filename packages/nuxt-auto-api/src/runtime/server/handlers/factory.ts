import type { EventHandler } from 'h3'
import { createHandler } from './base'
import { listHandler } from './list'
import { getHandler } from './get'
import { createHandler as createResourceHandler } from './create'
import { updateHandler } from './update'
import { deleteHandler } from './delete'
import { defaultValidate, createValidationMiddleware } from '../middleware/validate'
import { authenticate } from '../middleware/auth'
import { defaultAuthorize, createAuthorizationMiddleware } from '../middleware/authz'
import { generateSchemas } from '../validation/schemaGenerator'
import type { ResourceAuthConfig, ValidationSchema, ResourceHooks } from '../../types'

/**
 * Create handlers for a resource
 */
export function createResourceHandlers(
  resource: string,
  options: {
    db: any
    schema: any
    authorization?: ResourceAuthConfig
    validation?: ValidationSchema
    hooks?: ResourceHooks
  }
) {
  // Get the table for this resource
  // Handle both legacy (schema[resource]) and new (schema is already the table)
  let table: any
  if (options.schema[resource]) {
    // Legacy: schema is full schema object
    table = options.schema[resource]
  } else if (options.schema[Symbol.for('drizzle:Name')]) {
    // New: schema is already the table
    table = options.schema
    // Update schema to be object with resource key for compatibility
    options.schema = { [resource]: table }
  } else {
    console.warn(`[nuxt-auto-api] Could not find table for resource: ${resource}`)
  }

  // Generate validation schemas from the table using drizzle-zod
  let validationSchemas: ReturnType<typeof generateSchemas> | ValidationSchema | undefined

  // Use custom validation if provided, otherwise generate from table
  if (options.validation) {
    validationSchemas = options.validation as any
  } else if (table) {
    try {
      validationSchemas = generateSchemas(table)
    } catch (error) {
      console.warn(`[nuxt-auto-api] Failed to generate validation schemas for ${resource}`, error)
    }
  }

  // Create validation middleware with generated schemas
  const validate = validationSchemas
    ? createValidationMiddleware(validationSchemas)
    : defaultValidate

  // Create authorization middleware if custom authorization is provided
  const authorize = options.authorization
    ? createAuthorizationMiddleware(options.authorization)
    : defaultAuthorize

  return {
    list: createHandler(resource, 'list', {
      authenticate,
      authorize,
      validate,
      execute: listHandler,
    }, options),

    get: createHandler(resource, 'get', {
      authenticate,
      authorize,
      validate,
      execute: getHandler,
    }, options),

    create: createHandler(resource, 'create', {
      authenticate,
      authorize,
      validate,
      execute: createResourceHandler,
    }, options),

    update: createHandler(resource, 'update', {
      authenticate,
      authorize,
      validate,
      execute: updateHandler,
    }, options),

    delete: createHandler(resource, 'delete', {
      authenticate,
      authorize,
      validate,
      execute: deleteHandler,
    }, options),
  }
}
