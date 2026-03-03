/**
 * Recursively serialize data to ensure proper JSON serialization
 * - Converts Date objects to ISO strings
 * - Handles arrays and nested objects
 */
function serializeValue(value: any): any {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString()
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => serializeValue(item))
  }

  // Handle objects
  if (typeof value === 'object') {
    const serialized: Record<string, any> = {}
    for (const [key, val] of Object.entries(value)) {
      serialized[key] = serializeValue(val)
    }
    return serialized
  }

  // Return primitives as-is
  return value
}

/**
 * Serialize response data before sending to client
 * Ensures proper JSON serialization of Date objects and other special types
 */
export function serializeResponse<T = any>(data: T): T {
  return serializeValue(data) as T
}
