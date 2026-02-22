/**
 * Check if a value is likely a relation (object or array of objects)
 */
function isRelation(value: any): boolean {
  if (value === null || value === undefined) {
    return false
  }

  // Array of objects is a relation
  if (Array.isArray(value)) {
    return value.length > 0 && typeof value[0] === 'object'
  }

  // Object with an 'id' field is likely a relation
  if (typeof value === 'object' && 'id' in value) {
    return true
  }

  return false
}

/**
 * Filter returned fields based on selection
 *
 * Supports:
 * - fields=field1,field2 (select specific fields)
 * - No fields parameter returns all fields
 * - Preserves relations even when not explicitly in field list
 */
export function filterFields<T extends Record<string, any>>(
  data: T | T[],
  fields?: string | string[]
): T | T[] | Partial<T> | Partial<T>[] {
  if (!fields) {
    return data
  }

  const fieldArray = Array.isArray(fields)
    ? fields
    : String(fields).split(',').map(f => f.trim())

  const filterObject = (obj: T): Partial<T> => {
    const filtered: Partial<T> = {}

    // Add requested fields
    for (const field of fieldArray) {
      if (field in obj) {
        filtered[field as keyof T] = obj[field]
      }
    }

    // Preserve relations (they should not be removed by root field filtering)
    for (const [key, value] of Object.entries(obj)) {
      // If it's not already included and looks like a relation, preserve it
      if (!(key in filtered) && isRelation(value)) {
        filtered[key as keyof T] = value
      }
    }

    return filtered
  }

  if (Array.isArray(data)) {
    return data.map(filterObject)
  }

  return filterObject(data)
}
