import { getTableColumns } from 'drizzle-orm'
import type { DetectedJunction } from '../../../types'

/**
 * Detect junction table information from schema
 *
 * Supports multiple naming patterns:
 * - articleCategories (camelCase, singular)
 * - articlesCategories (camelCase, plural)
 * - article_categories (snake_case)
 * - categoriesArticles (reversed camelCase)
 * - categories_articles (reversed snake_case)
 */
export function detectJunction(
  schema: any,
  leftResource: string,
  rightResource: string,
  providedJunctionTable?: string
): DetectedJunction {
  // If junction table is explicitly provided, use it
  if (providedJunctionTable) {
    return detectFromTableName(schema, providedJunctionTable, leftResource, rightResource)
  }

  // Generate singular and plural variations
  const leftVariations = generateNameVariations(leftResource)
  const rightVariations = generateNameVariations(rightResource)

  // Try different naming patterns
  const patterns: string[] = []

  for (const left of leftVariations) {
    for (const right of rightVariations) {
      // camelCase: leftRight
      patterns.push(`${left}${capitalize(right)}`)
      // snake_case: left_right
      patterns.push(`${left}_${right}`)
    }
  }

  // Try reversed patterns too
  for (const right of rightVariations) {
    for (const left of leftVariations) {
      // camelCase: rightLeft
      patterns.push(`${right}${capitalize(left)}`)
      // snake_case: right_left
      patterns.push(`${right}_${left}`)
    }
  }

  // Remove duplicates while preserving order
  const uniquePatterns = [...new Set(patterns)]

  for (const pattern of uniquePatterns) {
    if (schema[pattern]) {
      return detectFromTableName(schema, pattern, leftResource, rightResource)
    }
  }

  throw new Error(
    `Junction table not found for relation ${leftResource} <-> ${rightResource}. ` +
    `Tried: ${uniquePatterns.slice(0, 10).join(', ')}${uniquePatterns.length > 10 ? '...' : ''}. ` +
    `Please provide junctionTable explicitly in M2M configuration.`
  )
}

/**
 * Detect junction information from a specific table
 */
function detectFromTableName(
  schema: any,
  tableName: string,
  leftResource: string,
  rightResource: string
): DetectedJunction {
  const table = schema[tableName]
  if (!table) {
    throw new Error(`Junction table ${tableName} not found in schema`)
  }

  const columns = getTableColumns(table)
  const columnNames = Object.keys(columns)

  // Detect left key (pattern: {resource}Id, {resource}_id, id{Resource})
  const leftKey = detectForeignKey(columnNames, leftResource)
  if (!leftKey) {
    throw new Error(
      `Could not detect left foreign key for ${leftResource} in junction table ${tableName}. ` +
      `Expected patterns: ${leftResource}Id, ${leftResource}_id, or id${capitalize(leftResource)}`
    )
  }

  // Detect right key
  const rightKey = detectForeignKey(columnNames, rightResource)
  if (!rightKey) {
    throw new Error(
      `Could not detect right foreign key for ${rightResource} in junction table ${tableName}. ` +
      `Expected patterns: ${rightResource}Id, ${rightResource}_id, or id${capitalize(rightResource)}`
    )
  }

  // Metadata columns = all columns except the two foreign keys
  const metadataColumns = columnNames.filter(
    name => name !== leftKey && name !== rightKey
  )

  return {
    tableName,
    leftResource,
    rightResource,
    leftKey,
    rightKey,
    metadataColumns,
    table,
  }
}

/**
 * Detect foreign key column name
 * Supports patterns:
 * - articleId (camelCase)
 * - article_id (snake_case)
 * - idArticle (prefixed)
 * Tries both singular and plural variations
 */
function detectForeignKey(columnNames: string[], resourceName: string): string | null {
  // Generate singular/plural variations
  const nameVariations = generateNameVariations(resourceName)

  // Try all variations with different patterns
  for (const name of nameVariations) {
    const patterns = [
      `${name}Id`,                    // articleId, articlesId
      `${name}_id`,                   // article_id, articles_id
      `id${capitalize(name)}`,        // idArticle, idArticles
    ]

    for (const pattern of patterns) {
      if (columnNames.includes(pattern)) {
        return pattern
      }
    }
  }

  return null
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Generate singular and plural variations of a resource name
 * Returns both the original and the singularized/pluralized form
 */
function generateNameVariations(resourceName: string): string[] {
  const variations = [resourceName]

  // Try to detect if it's plural and generate singular
  if (resourceName.endsWith('ies')) {
    // categories -> category
    variations.push(resourceName.slice(0, -3) + 'y')
  } else if (resourceName.endsWith('es') &&
             (resourceName.endsWith('sses') || resourceName.endsWith('ches') ||
              resourceName.endsWith('shes') || resourceName.endsWith('xes'))) {
    // classes -> class, boxes -> box
    variations.push(resourceName.slice(0, -2))
  } else if (resourceName.endsWith('s') && resourceName.length > 1) {
    // articles -> article, tags -> tag
    variations.push(resourceName.slice(0, -1))
  }

  // Also add plural form if it looks singular
  if (!resourceName.endsWith('s')) {
    if (resourceName.endsWith('y')) {
      // category -> categories
      variations.push(resourceName.slice(0, -1) + 'ies')
    } else if (resourceName.endsWith('s') || resourceName.endsWith('x') ||
               resourceName.endsWith('z') || resourceName.endsWith('ch') ||
               resourceName.endsWith('sh')) {
      // class -> classes, box -> boxes
      variations.push(resourceName + 'es')
    } else {
      // article -> articles
      variations.push(resourceName + 's')
    }
  }

  return [...new Set(variations)]
}

/**
 * Validate that junction configuration matches schema
 */
export function validateJunctionConfig(
  junction: DetectedJunction,
  schema: any
): void {
  // Verify table exists
  const table = schema[junction.tableName]
  if (!table) {
    throw new Error(`Junction table ${junction.tableName} not found in schema`)
  }

  // Verify columns exist
  const columns = getTableColumns(table)
  const columnNames = Object.keys(columns)

  if (!columnNames.includes(junction.leftKey)) {
    throw new Error(
      `Left key ${junction.leftKey} not found in junction table ${junction.tableName}. ` +
      `Available columns: ${columnNames.join(', ')}`
    )
  }

  if (!columnNames.includes(junction.rightKey)) {
    throw new Error(
      `Right key ${junction.rightKey} not found in junction table ${junction.tableName}. ` +
      `Available columns: ${columnNames.join(', ')}`
    )
  }

  // Verify metadata columns exist
  for (const metaCol of junction.metadataColumns) {
    if (!columnNames.includes(metaCol)) {
      throw new Error(
        `Metadata column ${metaCol} not found in junction table ${junction.tableName}. ` +
        `Available columns: ${columnNames.join(', ')}`
      )
    }
  }
}
