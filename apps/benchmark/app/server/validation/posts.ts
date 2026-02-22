import { createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'
import { posts } from '../database/schema.ts'

/**
 * Validation schemas for posts resource
 */

const baseInsertSchema = createInsertSchema(posts)

export const postsValidation = {
  create: baseInsertSchema.extend({
    title: z.string().min(3).max(200),
    content: z.string().min(10).optional(),
    published: z.boolean().default(false),
    userId: z.number().int().positive(),
  }),
  update: baseInsertSchema.partial().extend({
    title: z.string().min(3).max(200).optional(),
    content: z.string().min(10).optional(),
    published: z.boolean().optional(),
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
