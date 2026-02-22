import { buildNestedRelations, isEnhancedInclude, getRelationsConfig } from './buildNestedRelations'
import { createError } from 'h3'

/**
 * Validate that a relation exists in the Drizzle schema
 * Throws helpful error if relation is not defined
 */
function validateRelationExists(relationName: string, resourceName: string, db: any): void {
  // Check if db.query exists (relational queries)
  if (!db.query) {
    throw createError({
      statusCode: 500,
      message: `Relational queries not available. Make sure to pass the Drizzle schema to drizzle() constructor.`,
    })
  }

  // Check if the relation query exists
  const resourceQuery = db.query[resourceName]
  if (!resourceQuery) {
    throw createError({
      statusCode: 500,
      message: `Resource "${resourceName}" not found in Drizzle schema. Make sure it's exported from your schema file.`,
    })
  }

  // Note: We can't easily validate if a specific relation exists without trying to use it
  // Drizzle will throw an error at runtime if the relation doesn't exist
  // So we'll add a try-catch in the handlers to provide a better error message
}

/**
 * Extract relation name from include syntax (handles enhanced syntax)
 */
function extractRelationName(include: string): string {
  // Remove field selection: posts[id,title] -> posts
  let relation = include.replace(/\[([^\]]+)\]/, '')
  // Remove options: posts{limit:10} -> posts
  relation = relation.replace(/\{([^}]+)\}/, '')
  // Get first part before dot: posts.comments -> posts
  const dotIndex = relation.indexOf('.')
  if (dotIndex > 0) {
    relation = relation.substring(0, dotIndex)
  }
  return relation.trim()
}

/**
 * Build relations configuration from include parameter
 *
 * Supports:
 * - include=relation1,relation2 (include specific relations)
 * - include=relation1.nested1 (nested relations)
 * - include=posts[id,title] (field selection - enhanced syntax)
 * - include=posts{limit:10} (pagination - enhanced syntax)
 * - include=posts{filter:{published:true}} (filtering - enhanced syntax)
 * - include=posts[id,title]{limit:10,filter:{published:true}} (combined - enhanced syntax)
 *
 * Returns an object suitable for Drizzle's `with` option
 */
export function buildRelations(
  include: string | string[] | undefined,
  schema: any,
  resourceName?: string,
  db?: any
): Record<string, any> | undefined {
  if (!include) {
    return undefined
  }

  // Check for enhanced syntax BEFORE splitting on comma
  // because enhanced syntax can contain commas inside brackets: author[id,name]
  const includeStr = Array.isArray(include) ? include.join(',') : String(include)
  const hasEnhancedSyntax = isEnhancedInclude(includeStr)

  // Only split on comma if NOT using enhanced syntax
  // Enhanced syntax will be parsed by buildNestedRelations which handles commas correctly
  const includeArray = Array.isArray(include)
    ? include
    : hasEnhancedSyntax
      ? [includeStr] // Don't split - let buildNestedRelations handle it
      : String(include).split(',').map(i => i.trim())

  if (includeArray.length === 0) {
    return undefined
  }

  // Validate that db.query is available if we have includes
  if (db && resourceName) {
    validateRelationExists('', resourceName, db)
  }

  if (hasEnhancedSyntax) {
    // Use the new nested relations builder
    const config = getRelationsConfig()
    return buildNestedRelations(includeArray, schema, config.maxDepth)
  }

  // Legacy simple syntax - backward compatible
  const result: Record<string, any> = {}

  for (const relationPath of includeArray) {
    const parts = relationPath.split('.')
    let current = result

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      if (!current[part]) {
        if (isLast) {
          current[part] = true
        } else {
          current[part] = { with: {} }
        }
      } else if (current[part] === true && !isLast) {
        // If it was previously a leaf but now we need to go deeper
        current[part] = { with: {} }
      }

      if (!isLast) {
        // Navigate into 'with'
        current = current[part].with
      }
    }
  }

  return result
}

/**
 * Create a helpful error message for missing relations
 */
export function createRelationError(relationName: string, resourceName: string, error?: Error): Error {
  const message = `
Failed to load relation "${relationName}" for resource "${resourceName}".

This usually means the relation is not defined in your Drizzle schema.

To fix this, define the relation using Drizzle's relations() function:

import { relations } from 'drizzle-orm'

export const ${resourceName}Relations = relations(${resourceName}, ({ many, one }) => ({
  ${relationName}: many(${relationName}Table), // or one(...) for one-to-one/many-to-one
}))

Make sure to:
1. Export the relations definition from your schema file
2. Pass the schema to drizzle() constructor
3. Define both sides of the relationship (if applicable)

Original error: ${error?.message || 'Unknown error'}
`.trim()

  return createError({
    statusCode: 400,
    message,
  })
}
