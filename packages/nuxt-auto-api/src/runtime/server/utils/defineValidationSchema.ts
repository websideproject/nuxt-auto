import { z } from 'zod'
import { defineValidationSchema as defineSchema } from '../validation/schemaGenerator'

/**
 * Define a validation schema for a resource
 * This is a convenience export for users
 */
export { defineSchema as defineValidationSchema }
