/**
 * Clean relations config by removing metadata properties that Drizzle doesn't understand
 * Removes _selectFields and other internal properties before passing to Drizzle
 *
 * @param relationsConfig - Relations config with possible metadata
 * @returns Clean config safe for Drizzle
 */
export function cleanRelationsConfig(
  relationsConfig?: Record<string, any>
): Record<string, any> | undefined {
  if (!relationsConfig) {
    return undefined
  }

  const cleanObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(cleanObject)
    }

    const cleaned: Record<string, any> = {}

    for (const [key, value] of Object.entries(obj)) {
      // Skip metadata properties (those starting with _)
      if (key.startsWith('_')) {
        continue
      }

      // Don't traverse into Drizzle specific properties that might be complex objects
      if (['where', 'columns', 'orderBy', 'extras'].includes(key)) {
        cleaned[key] = value
        continue
      }

      // Recursively clean nested objects
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = cleanObject(value)
      } else {
        cleaned[key] = value
      }
    }

    // If after cleaning we have an empty object, return true instead
    // Drizzle expects `true` for simple relation includes
    if (Object.keys(cleaned).length === 0) {
      return true
    }

    return cleaned
  }

  return cleanObject(relationsConfig)
}
