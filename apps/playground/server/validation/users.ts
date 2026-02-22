import { createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../database/schema.ts'

/**
 * Validation schemas for users resource
 *
 * This shows how to extend the auto-generated schema from drizzle-zod
 * with custom validation rules
 */

// Generate base schema from Drizzle table
const baseInsertSchema = createInsertSchema(users)

export const usersValidation = {
  create: baseInsertSchema.extend({
    email: z.string().email().toLowerCase().min(1),
    name: z.string().min(2).max(100),
    role: z.enum(['user', 'admin', 'editor']).default('user'),
  }),
  update: baseInsertSchema.partial().extend({
    email: z.string().email().toLowerCase().optional(),
    name: z.string().min(2).max(100).optional(),
  }),
  query: z.object({
    filter: z.record(z.string(), z.any()).optional(),
    sort: z.union([z.string(), z.array(z.string())]).optional(),
    fields: z.union([z.string(), z.array(z.string())]).optional(),
    include: z.union([z.string(), z.array(z.string())]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }).optional(),
}
