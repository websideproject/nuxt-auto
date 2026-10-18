import { getTableColumns, getTableName } from 'drizzle-orm'
import { fkColKey, tableForeignKeys } from '../softDeleteCascade'

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
 * A table is considered a junction table if it has no standalone 'id' column and either:
 * 1. Exactly 2 single-column foreign keys (`.references()`) to two resources — names do not matter, or
 * 2. (no such foreign keys) exactly 2 columns that look like foreign keys (end with Id/_id) and a name that
 *    combines the two resources (camelCase or snake_case).
 * All other columns (if any) are metadata (sortOrder, createdAt, etc.)
 *
 * `schema` may hold tables that are not resources (a junction does not have to be registered); both ends of a
 * junction must be one of `resourceNames` (default: every key of `schema`).
 */
export function detectAllJunctionTables(schema: Record<string, any>, resourceNames: string[] = Object.keys(schema)): JunctionTableInfo[] {
  const junctionTables: JunctionTableInfo[] = []
  const availableResources = resourceNames

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
  availableResources: string[],
): JunctionTableInfo | null {
  try {
    const columns = getTableColumns(table)
    const columnEntries = Object.entries(columns)

    // Check if table has a standalone 'id' column
    // Junction tables typically don't have their own ID
    const hasStandaloneId = columnEntries.some(([name]: [string, any]) => {
      return name === 'id' || name === 'ID'
    })

    // If it has a standalone ID, it's probably not a pure junction table
    if (hasStandaloneId) {
      return null
    }

    // Strategy 1: Drizzle foreign keys (`.references()` / `foreignKey()`), read from the table config
    const foreignKeys = tableForeignKeys(table).filter(fk => fk.columns.length === 1)

    if (foreignKeys.length === 2) {
      const [left, right] = foreignKeys as [typeof foreignKeys[0], typeof foreignKeys[0]]
      const leftTarget = resourceForTable(left.foreignTable, schema, availableResources)
      const rightTarget = resourceForTable(right.foreignTable, schema, availableResources)

      if (leftTarget && rightTarget) {
        const leftCol = fkColKey(table, left.columns[0])
        const rightCol = fkColKey(table, right.columns[0])
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

    const [[leftCol], [rightCol]] = potentialFKColumns as [[string, unknown], [string, unknown]]

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
  }
  catch {
    // If analysis fails, it's not a valid junction table
    return null
  }
}

/**
 * The resource whose table a foreign key references: matched by table object, then by SQL table name.
 */
function resourceForTable(
  referencedTable: any,
  schema: Record<string, any>,
  availableResources: string[],
): string | null {
  for (const resourceName of availableResources) {
    if (schema[resourceName] === referencedTable) return resourceName
  }
  for (const resourceName of availableResources) {
    try {
      if (getTableName(schema[resourceName]) === getTableName(referencedTable)) return resourceName
    }
    catch {
      // not a table
    }
  }
  return null
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

  // Suffix match (case-insensitive): handles prefixed resource names
  // e.g., 'task' matches 'sampleTasks', 'label' matches 'sampleLabels'
  const lowerBase = baseResource.toLowerCase()
  for (const resource of availableResources) {
    const lower = resource.toLowerCase()
    if (
      lower.endsWith(lowerBase)
      || lower.endsWith(lowerBase + 's')
      || lower.endsWith(lowerBase + 'es')
      || (lowerBase.endsWith('y') && lower.endsWith(lowerBase.slice(0, -1) + 'ies'))
    ) {
      return resource
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
  if (baseResource.endsWith('s') || baseResource.endsWith('x')
    || baseResource.endsWith('z') || baseResource.endsWith('ch')
    || baseResource.endsWith('sh')) {
    variations.push(baseResource + 'es')
  }

  // 3. Change 'y' to 'ies': category -> categories
  if (baseResource.endsWith('y') && baseResource.length > 1) {
    const prevChar = baseResource[baseResource.length - 2]
    // Only if 'y' is preceded by a consonant
    if (prevChar && !'aeiou'.includes(prevChar.toLowerCase())) {
      variations.push(baseResource.slice(0, -1) + 'ies')
    }
  }

  // 4. Irregular plurals (can be extended)
  const irregularPlurals: Record<string, string> = {
    person: 'people',
    child: 'children',
    man: 'men',
    woman: 'women',
    tooth: 'teeth',
    foot: 'feet',
    mouse: 'mice',
    goose: 'geese',
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
  rightBase: string,
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

  if (patterns.includes(tableName)) {
    return true
  }

  // Substring match for prefixed resource names
  // e.g., 'sampleTaskLabels' contains both 'task' and 'label'
  const lowerTableName = tableName.toLowerCase()
  if (lowerTableName.includes(leftBase.toLowerCase()) && lowerTableName.includes(rightBase.toLowerCase())) {
    return true
  }

  return false
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
  schema: Record<string, any>,
  resourceNames: string[] = Object.keys(schema),
): M2MRelationship[] {
  const junctionTables = detectAllJunctionTables(schema, resourceNames)
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
    }
    else if (junction.rightResource === resourceName) {
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
export function getAllJunctionTableNames(schema: Record<string, any>, resourceNames: string[] = Object.keys(schema)): string[] {
  const junctionTables = detectAllJunctionTables(schema, resourceNames)
  return junctionTables.map(j => j.tableName)
}

/**
 * Check if a specific table is a junction table
 */
export function isJunctionTable(tableName: string, schema: Record<string, any>, resourceNames: string[] = Object.keys(schema)): boolean {
  const table = schema[tableName]
  if (!table) return false

  return analyzeTableAsJunction(tableName, table, schema, resourceNames) !== null
}
