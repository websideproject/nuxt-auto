import { createError } from 'h3'
import { readBody } from 'h3'
import { z } from 'zod'
import type { HandlerContext } from '../../types'
import { generateQuerySchema } from '../validation/schemaGenerator'

/**
 * Validation middleware factory
 * Creates a validation function for a specific schema
 */
export function createValidationMiddleware(schemas?: {
  create?: z.ZodType<any>
  update?: z.ZodType<any>
  query?: z.ZodType<any>
}) {
  return async (context: HandlerContext) => {
    const { operation, query, event } = context

    try {
      // Pre-parse filter JSON string to object to allow strict validation schemas
      // This improves DX by allowing users to use z.record() without z.union([z.string(), ...])
      if (query && typeof query.filter === 'string') {
        try {
          query.filter = JSON.parse(query.filter)
        } catch (e) {
          // If parsing fails, leave as string - validation or handler will catch it
        }
      }

      // Validate query parameters for all operations
      if (schemas?.query) {
        const validated = await schemas.query.parseAsync(query)
        context.validated.query = validated
      } else {
        // Use default query schema
        const defaultQuerySchema = generateQuerySchema()
        const validated = await defaultQuerySchema.parseAsync(query)
        context.validated.query = validated
      }

      // Validate body for create/update operations
      if (operation === 'create' || operation === 'update') {
        const body = await readBody(event)

        if (operation === 'create' && schemas?.create) {
          const validated = await schemas.create.parseAsync(body)
          context.validated.body = validated
        } else if (operation === 'update' && schemas?.update) {
          const validated = await schemas.update.parseAsync(body)
          context.validated.body = validated
        } else {
          // No validation schema, pass through
          context.validated.body = body
        }
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw createError({
          statusCode: 400,
          message: 'Validation error',
          data: {
            errors: error.issues,
          },
        })
      }
      throw error
    }
  }
}

/**
 * Default validation middleware
 * Validates query parameters with default schema
 */
export async function defaultValidate(context: HandlerContext): Promise<void> {
  const validate = createValidationMiddleware()
  await validate(context)
}
