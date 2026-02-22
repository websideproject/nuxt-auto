import { getTableColumns, getTableName } from 'drizzle-orm'

export interface JunctionTableInfo {
  /**
   * Junction table name
   */
  tableName: string

  /**
   * Left resource name (e.g., 'articles')
   */
  leftResource: string

  /**
   * Right resource name (e.g., 'categories')
   */
  rightResource: string

  /**
   * Left foreign key column name
   */
  leftKey: string

  /**
   * Right foreign key column name
   */
  rightKey: string

  /**
   * Additional metadata columns
   */
  metadataColumns: string[]

  /**
   * Drizzle table object
   */
  table: any
}

export interface M2MRelationship {
  /**
   * Resource this relationship belongs to (e.g., 'articles')
   */
  resource: string

  /**
   * Name of the related resource (e.g., 'categories')
   */
  relatedResource: string

  /**
   * Junction table information
   */
  junction: JunctionTableInfo

  /**
   * Direction: 'left' if resource is on left side, 'right' if on right side
   */
  direction: 'left' | 'right'
}

/**
 * Detect all junction tables in the schema
 *
 * A table is considered a junction table if:
 * 1. Has exactly 2 columns that appear to be foreign keys (end with Id/_id)
 * 2. Has no standalone 'id' column
 * 3. Name follows pattern: resourceA + resourceB (supports both camelCase and snake_case)
 * 4. All other columns (if any) are metadata (sortOrder, createdAt, etc.)
 */
export function detectAllJunctionTables(schema: Record<string, any>): JunctionTableInfo[] {
  const junctionTables: JunctionTableInfo[] = []
  const availableResources = Object.keys(schema)

  for (const [tableName, table] of Object.entries(schema)) {
    const junctionInfo = analyzeTableAsJunction(tableName, table, schema, availableResources)
    if (junctionInfo) {
      junctionTables.push(junctionInfo)
    }
  }

  return junctionTables
}

/**
 * Analyze a table to determine if it's a junction table
 * Uses Drizzle FK references FIRST, falls back to heuristics if needed
 */
function analyzeTableAsJunction(
  tableName: string,
  table: any,
  schema: Record<string, any>,
  availableResources: string[]
): JunctionTableInfo | null {
  try {
    const columns = getTableColumns(table)
    const columnEntries = Object.entries(columns)

    // Check if table has a standalone 'id' column
    // Junction tables typically don't have their own ID
    const hasStandaloneId = columnEntries.some(([name, col]: [string, any]) => {
      return name === 'id' || name === 'ID'
    })

    // If it has a standalone ID, it's probably not a pure junction table
    if (hasStandaloneId) {
      return null
    }

    // Strategy 1: Use Drizzle FK references (most accurate)
    const fkColumnsFromReferences = columnEntries.filter(([_, col]: [string, any]) => {
      return col.references || col.foreignKeys?.length > 0
    })

    if (fkColumnsFromReferences.length === 2) {
      // Extract resource names from Drizzle references
      const [leftColEntry, rightColEntry] = fkColumnsFromReferences
      const [leftCol, leftColData] = leftColEntry
      const [rightCol, rightColData] = rightColEntry

      const leftTarget = extractTargetFromReference(leftColData, schema, availableResources)
      const rightTarget = extractTargetFromReference(rightColData, schema, availableResources)

      if (leftTarget && rightTarget) {
        // Get metadata columns (all columns except the two FKs)
        const metadataColumns = columnEntries
          .filter(([name]) => name !== leftCol && name !== rightCol)
          .map(([name]) => name)

        return {
          tableName,
          leftResource: leftTarget,
          rightResource: rightTarget,
          leftKey: leftCol,
          rightKey: rightCol,
          metadataColumns,
          table,
        }
      }
    }

    // Strategy 2: Fallback to heuristic column name matching
    const potentialFKColumns = columnEntries.filter(([name]: [string, any]) => {
      return isForeignKeyColumn(name)
    })

    // Must have exactly 2 foreign key columns
    if (potentialFKColumns.length !== 2) {
      return null
    }

    const [leftCol] = potentialFKColumns[0]
    const [rightCol] = potentialFKColumns[1]

    // Extract resource names from foreign key columns
    const leftResourceBase = extractResourceFromColumn(leftCol)
    const rightResourceBase = extractResourceFromColumn(rightCol)

    if (!leftResourceBase || !rightResourceBase) {
      return null
    }

    // Find actual resource names from registry (handles singular/plural variations)
    const leftResource = findResourceName(leftResourceBase, availableResources)
    const rightResource = findResourceName(rightResourceBase, availableResources)

    if (!leftResource || !rightResource) {
      return null
    }

    // Verify naming pattern matches expected junction table patterns
    if (!matchesJunctionPattern(tableName, leftResource, rightResource, leftResourceBase, rightResourceBase)) {
      return null
    }

    // Get metadata columns (all columns except the two FKs)
    const metadataColumns = columnEntries
      .filter(([name]) => name !== leftCol && name !== rightCol)
      .map(([name]) => name)

    return {
      tableName,
      leftResource,
      rightResource,
      leftKey: leftCol,
      rightKey: rightCol,
      metadataColumns,
      table,
    }
  } catch (error) {
    // If analysis fails, it's not a valid junction table
    return null
  }
}

/**
 * Extract target resource name from Drizzle FK reference
 * Tries to match the referenced table against available resources
 */
function extractTargetFromReference(
  column: any,
  schema: Record<string, any>,
  availableResources: string[]
): string | null {
  try {
    // Call the references function to get the target table
    const referencedTable = column.references?.()

    if (!referencedTable) {
      return null
    }

    // Find which resource this table belongs to by comparing table objects
    for (const resourceName of availableResources) {
      const resourceTable = schema[resourceName]
      if (resourceTable === referencedTable) {
        return resourceName
      }

      // Also try comparing table names using getTableName
      try {
        const refTableName = getTableName(referencedTable)
        const resTableName = getTableName(resourceTable)
        if (refTableName === resTableName) {
          return resourceName
        }
      } catch (e) {
        // getTableName might fail on some table types
      }
    }

    // If no exact match, try to extract from table metadata
    // Some Drizzle table objects have a [Symbol] property with the table name
    const tableName = referencedTable?.[Symbol.for('drizzle:Name')]
      || referencedTable?._.name
      || referencedTable?.dbName

    if (tableName && availableResources.includes(tableName)) {
      return tableName
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Check if a column name looks like a foreign key
 */
function isForeignKeyColumn(columnName: string): boolean {
  // Pattern 1: ends with Id (camelCase)
  if (columnName.endsWith('Id')) {
    return true
  }

  // Pattern 2: ends with _id (snake_case)
  if (columnName.endsWith('_id')) {
    return true
  }

  // Pattern 3: starts with id (prefix pattern like idArticle)
  if (columnName.startsWith('id') && columnName.length > 2) {
    return true
  }

  return false
}

/**
 * Extract resource name from column name
 * Supports both camelCase and snake_case
 * Examples:
 * - articleId -> article
 * - article_id -> article
 * - idArticle -> article
 * - category_id -> category
 */
function extractResourceFromColumn(columnName: string): string | null {
  // Pattern 1: articleId -> article (camelCase)
  if (columnName.endsWith('Id')) {
    return columnName.slice(0, -2)
  }

  // Pattern 2: article_id -> article (snake_case)
  if (columnName.endsWith('_id')) {
    return columnName.slice(0, -3)
  }

  // Pattern 3: idArticle -> article (prefix pattern)
  if (columnName.startsWith('id') && columnName.length > 2) {
    const resource = columnName.slice(2)
    return resource.charAt(0).toLowerCase() + resource.slice(1)
  }

  return null
}

/**
 * Find the actual resource name from registry
 * Handles singular/plural variations and naming conventions
 *
 * Examples:
 * - article -> articles
 * - category -> categories
 * - tag -> tags
 * - user -> users
 */
function findResourceName(baseResource: string, availableResources: string[]): string | null {
  // Exact match
  if (availableResources.includes(baseResource)) {
    return baseResource
  }

  // Generate possible variations
  const variations = generateResourceVariations(baseResource)

  // Find first matching variation
  for (const variation of variations) {
    if (availableResources.includes(variation)) {
      return variation
    }
  }

  return null
}

/**
 * Generate possible resource name variations
 * Handles pluralization and naming conventions
 */
function generateResourceVariations(baseResource: string): string[] {
  const variations: string[] = []

  // Add exact match first
  variations.push(baseResource)

  // Common pluralization patterns
  // 1. Add 's': article -> articles
  variations.push(baseResource + 's')

  // 2. Add 'es': class -> classes, box -> boxes
  if (baseResource.endsWith('s') || baseResource.endsWith('x') ||
      baseResource.endsWith('z') || baseResource.endsWith('ch') ||
      baseResource.endsWith('sh')) {
    variations.push(baseResource + 'es')
  }

  // 3. Change 'y' to 'ies': category -> categories
  if (baseResource.endsWith('y') && baseResource.length > 1) {
    const prevChar = baseResource[baseResource.length - 2]
    // Only if 'y' is preceded by a consonant
    if (!'aeiou'.includes(prevChar.toLowerCase())) {
      variations.push(baseResource.slice(0, -1) + 'ies')
    }
  }

  // 4. Irregular plurals (can be extended)
  const irregularPlurals: Record<string, string> = {
    'person': 'people',
    'child': 'children',
    'man': 'men',
    'woman': 'women',
    'tooth': 'teeth',
    'foot': 'feet',
    'mouse': 'mice',
    'goose': 'geese',
  }

  if (irregularPlurals[baseResource]) {
    variations.push(irregularPlurals[baseResource])
  }

  // Remove duplicates
  return [...new Set(variations)]
}

/**
 * Check if table name matches expected junction table patterns
 * Supports both camelCase and snake_case for all combinations
 *
 * Supported patterns:
 * - articleCategories (camelCase with plural)
 * - article_categories (snake_case with plural)
 * - articleCategory (camelCase with singular)
 * - article_category (snake_case with singular)
 * - And reversed versions
 */
function matchesJunctionPattern(
  tableName: string,
  leftResource: string,
  rightResource: string,
  leftBase: string,
  rightBase: string
): boolean {
  const patterns: string[] = []

  // Generate all possible combinations
  const leftVariations = [leftResource, leftBase]
  const rightVariations = [rightResource, rightBase]

  for (const left of leftVariations) {
    for (const right of rightVariations) {
      // camelCase: leftRight
      patterns.push(`${left}${capitalize(right)}`)

      // snake_case: left_right
      patterns.push(`${left}_${right}`)

      // Reversed camelCase: rightLeft
      patterns.push(`${right}${capitalize(left)}`)

      // Reversed snake_case: right_left
      patterns.push(`${right}_${left}`)
    }
  }

  return patterns.includes(tableName)
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get all M2M relationships for a specific resource
 *
 * Example: For 'articles', returns relationships to 'categories' and 'tags'
 */
export function getM2MRelationshipsForResource(
  resourceName: string,
  schema: Record<string, any>
): M2MRelationship[] {
  const junctionTables = detectAllJunctionTables(schema)
  const relationships: M2MRelationship[] = []

  for (const junction of junctionTables) {
    // Check if this junction involves the resource
    if (junction.leftResource === resourceName) {
      relationships.push({
        resource: resourceName,
        relatedResource: junction.rightResource,
        junction,
        direction: 'left',
      })
    } else if (junction.rightResource === resourceName) {
      relationships.push({
        resource: resourceName,
        relatedResource: junction.leftResource,
        junction,
        direction: 'right',
      })
    }
  }

  return relationships
}

/**
 * Get all junction table names (for filtering)
 */
export function getAllJunctionTableNames(schema: Record<string, any>): string[] {
  const junctionTables = detectAllJunctionTables(schema)
  return junctionTables.map(j => j.tableName)
}

/**
 * Check if a specific table is a junction table
 */
export function isJunctionTable(tableName: string, schema: Record<string, any>): boolean {
  const table = schema[tableName]
  if (!table) return false

  const availableResources = Object.keys(schema)
  return analyzeTableAsJunction(tableName, table, schema, availableResources) !== null
}
