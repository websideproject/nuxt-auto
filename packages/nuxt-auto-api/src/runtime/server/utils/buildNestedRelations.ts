import type { NestedRelationConfig } from '../../types'
import { buildWhereClause } from './buildWhereClause'

/**
 * Parse enhanced include syntax to extract relation name, fields, and options
 *
 * Syntax examples:
 * - posts[id,title] - field selection
 * - posts{limit:10} - pagination
 * - posts{filter:{published:true}} - filtering
 * - posts[id,title]{limit:10,filter:{published:true}} - combined
 * - posts.comments[id,body].author[id,name] - nested with field selection
 */
export function parseEnhancedInclude(include: string): {
  relation: string
  fields?: string[]
  options?: {
    limit?: number
    offset?: number
    filter?: Record<string, any>
  }
  nested?: string
} {
  let relationName = ''
  let fieldsStr = ''
  let optionsStr = ''
  let nested = ''
  
  // Step 1: Separate the main relation part from the nested part (if any)
  // We need to find the first dot that is NOT inside [] or {}
  let balance = 0
  let splitIndex = -1
  
  for (let i = 0; i < include.length; i++) {
    const char = include[i]
    if (char === '[' || char === '{') balance++
    else if (char === ']' || char === '}') balance--
    else if (char === '.' && balance === 0) {
      splitIndex = i
      break
    }
  }
  
  let currentPart = ''
  if (splitIndex !== -1) {
    currentPart = include.substring(0, splitIndex)
    nested = include.substring(splitIndex + 1)
  } else {
    currentPart = include
  }

  // Step 2: Parse relation name, fields [], and options {} from currentPart
  // Strategy: Identify blocks [] and {}
  
  let cursor = 0
  let nameEnd = currentPart.length
  
  // Find start of [ or {
  const bracketStart = currentPart.indexOf('[')
  const braceStart = currentPart.indexOf('{')
  
  if (bracketStart !== -1 && (braceStart === -1 || bracketStart < braceStart)) {
    nameEnd = bracketStart
  } else if (braceStart !== -1) {
    nameEnd = braceStart
  }
  
  relationName = currentPart.substring(0, nameEnd)
  
  // Extract fields if present
  if (bracketStart !== -1) {
    const bracketEnd = currentPart.indexOf(']', bracketStart)
    if (bracketEnd !== -1) {
      fieldsStr = currentPart.substring(bracketStart + 1, bracketEnd)
    }
  }
  
  // Extract options if present
  // Note: options might contain nested braces for filter JSON
  if (braceStart !== -1) {
    // Find the matching closing brace
    let openBraces = 0
    let braceEnd = -1
    for (let i = braceStart; i < currentPart.length; i++) {
      if (currentPart[i] === '{') openBraces++
      else if (currentPart[i] === '}') {
        openBraces--
        if (openBraces === 0) {
          braceEnd = i
          break
        }
      }
    }
    
    if (braceEnd !== -1) {
      optionsStr = currentPart.substring(braceStart + 1, braceEnd)
    }
  }

  // Step 3: Process extracted parts
  const fields = fieldsStr ? fieldsStr.split(',').map(f => f.trim()) : undefined
  let options: any = undefined

  if (optionsStr) {
    options = {}
    
    // Parse limit
    const limitMatch = optionsStr.match(/limit:(\d+)/)
    if (limitMatch) options.limit = parseInt(limitMatch[1])
    
    // Parse offset
    const offsetMatch = optionsStr.match(/offset:(\d+)/)
    if (offsetMatch) options.offset = parseInt(offsetMatch[1])
    
    // Parse filter
    // We look for "filter:" and then try to capture the JSON object following it
    const filterIndex = optionsStr.indexOf('filter:')
    if (filterIndex !== -1) {
      const jsonStart = optionsStr.indexOf('{', filterIndex)
      if (jsonStart !== -1) {
        // Extract JSON object by balancing braces
        let open = 0
        let jsonEnd = -1
        for (let i = jsonStart; i < optionsStr.length; i++) {
          if (optionsStr[i] === '{') open++
          else if (optionsStr[i] === '}') {
            open--
            if (open === 0) {
              jsonEnd = i + 1
              break
            }
          }
        }
        
        if (jsonEnd !== -1) {
          try {
            const jsonStr = optionsStr.substring(jsonStart, jsonEnd)
            // Attempt to make it valid JSON by quoting keys if they are not quoted
            const fixedJson = jsonStr.replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
            options.filter = JSON.parse(fixedJson)
          } catch (e) {
            console.warn('[autoApi] Failed to parse filter JSON:', e)
          }
        }
      }
    }
  }

  return {
    relation: relationName,
    fields,
    options,
    nested: nested || undefined
  }
}

/**
 * Check if a string contains enhanced include syntax
 */
export function isEnhancedInclude(include: string): boolean {
  return include.includes('[') || include.includes('{')
}

/**
 * Build nested relations configuration with field selection, filtering, and pagination
 *
 * @param include - Array of include strings with enhanced syntax
 * @param schema - Drizzle schema object
 * @param maxDepth - Maximum nesting depth (default: 3)
 * @returns Drizzle-compatible with object
 */
export function buildNestedRelations(
  include: string | string[],
  schema: any,
  maxDepth: number = 3
): Record<string, any> | undefined {
  if (!include) {
    return undefined
  }

  const includeArray = Array.isArray(include)
    ? include
    : String(include).split(',').map(i => i.trim())

  if (includeArray.length === 0) {
    return undefined
  }

  const result: Record<string, any> = {}

  for (const includePath of includeArray) {
    buildNestedRelation(result, includePath, schema, 0, maxDepth)
  }

  return result
}

/**
 * Recursively build a nested relation configuration
 */
function buildNestedRelation(
  target: Record<string, any>,
  includePath: string,
  schema: any,
  currentDepth: number,
  maxDepth: number
): void {
  if (currentDepth >= maxDepth) {
    console.warn(`[autoApi] Max nesting depth ${maxDepth} reached for: ${includePath}`)
    return
  }

  const parsed = parseEnhancedInclude(includePath)
  const { relation, fields, options, nested } = parsed

  if (!target[relation]) {
    target[relation] = {}
  }

  // Ensure target[relation] is an object
  if (target[relation] === true) {
    target[relation] = {}
  }

  const relationConfig = target[relation]

  // Use Drizzle's columns option for field selection
  if (fields && fields.length > 0) {
    relationConfig.columns = fields.reduce((acc: Record<string, boolean>, field: string) => {
      acc[field] = true
      return acc
    }, {})
  }

  // Add filter (where clause)
  if (options?.filter) {
    // Get the related table from schema to build proper where clause
    // Note: relation name might not match table name (e.g., 'author' -> 'users')
    // Try to find the table, but don't fail if not found - Drizzle will handle it
    const relatedTable = schema[relation]
    if (relatedTable) {
      relationConfig.where = buildWhereClause(options.filter, relatedTable)
    } else {
      // If we can't find the table by relation name, store filter for now
      // This will fail at query time if the filter is invalid
      console.warn(`[autoApi] Could not find table for relation '${relation}' in schema. Filter may fail at query time.`)
    }
  }

  // Add pagination
  if (options?.limit) {
    relationConfig.limit = options.limit
  }
  if (options?.offset) {
    relationConfig.offset = options.offset
  }

  // Handle nested relations
  if (nested) {
    if (!relationConfig.with) {
      relationConfig.with = {}
    }
    buildNestedRelation(relationConfig.with, nested, schema, currentDepth + 1, maxDepth)
  }
}

/**
 * Get the runtime config for relations
 */
export function getRelationsConfig() {
  const runtimeConfig = useRuntimeConfig?.()
  return {
    maxDepth: runtimeConfig?.autoApi?.relations?.maxDepth ?? 3,
    allowFieldSelection: runtimeConfig?.autoApi?.relations?.allowFieldSelection ?? true,
    allowFiltering: runtimeConfig?.autoApi?.relations?.allowFiltering ?? true,
    allowPagination: runtimeConfig?.autoApi?.relations?.allowPagination ?? true,
  }
}

/**
 * Validate enhanced include syntax
 */
export function validateEnhancedInclude(
  include: string | string[],
  schema: any
): { valid: boolean; error?: string } {
  const config = getRelationsConfig()

  const includeArray = Array.isArray(include)
    ? include
    : String(include).split(',').map(i => i.trim())

  for (const includePath of includeArray) {
    const parsed = parseEnhancedInclude(includePath)
    const { relation, fields, options } = parsed

    // Check if relation exists in schema
    if (!schema[relation]) {
      return {
        valid: false,
        error: `Unknown relation: ${relation}`
      }
    }

    // Check if field selection is allowed
    if (fields && fields.length > 0 && !config.allowFieldSelection) {
      return {
        valid: false,
        error: 'Field selection is disabled'
      }
    }

    // Check if filtering is allowed
    if (options?.filter && !config.allowFiltering) {
      return {
        valid: false,
        error: 'Filtering on relations is disabled'
      }
    }

    // Check if pagination is allowed
    if ((options?.limit || options?.offset) && !config.allowPagination) {
      return {
        valid: false,
        error: 'Pagination on relations is disabled'
      }
    }
  }

  return { valid: true }
}
