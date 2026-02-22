import type { HandlerContext } from '../../types'

/**
 * Get list of hidden fields for a resource
 * Merges global, per-resource config, and resource registration
 * If includeAllResources is true, gets hidden fields from all resources (for filtering nested relations)
 */
export function getHiddenFields(context: HandlerContext, includeAllResources = true): string[] {
  const hiddenFields = new Set<string>()
  const runtimeConfig = useRuntimeConfig?.()

  // Global hidden fields (from config)
  const globalFields = runtimeConfig?.autoApi?.hiddenFields?.global
  if (globalFields && Array.isArray(globalFields)) {
    globalFields.forEach(field => hiddenFields.add(field))
  }

  // Per-resource hidden fields (from config)
  const resourceConfigFields = runtimeConfig?.autoApi?.hiddenFields?.resources?.[context.resource]
  if (resourceConfigFields && Array.isArray(resourceConfigFields)) {
    resourceConfigFields.forEach(field => hiddenFields.add(field))
  }

  // Resource registration hidden fields (from registry)
  const registryFields = context.resourceConfig?.hiddenFields
  if (registryFields && Array.isArray(registryFields)) {
    registryFields.forEach(field => hiddenFields.add(field))
  }

  // Include hidden fields from ALL resources (for filtering nested relations)
  if (includeAllResources && context.registry) {
    Object.values(context.registry).forEach((resourceConfig: any) => {
      if (resourceConfig.hiddenFields && Array.isArray(resourceConfig.hiddenFields)) {
        resourceConfig.hiddenFields.forEach((field: string) => hiddenFields.add(field))
      }
    })
  }

  return Array.from(hiddenFields)
}

/**
 * Check if value is a plain object (not Date, Array, or other special types)
 */
function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') {
    return false
  }

  // Exclude special object types
  if (value instanceof Date || value instanceof RegExp || value instanceof Error) {
    return false
  }

  if (Array.isArray(value)) {
    return false
  }

  // Check if it's a plain object
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

/**
 * Filter hidden fields from a single object
 */
function filterObjectHiddenFields(
  obj: Record<string, any>,
  hiddenFields: string[],
  recursive: boolean = true
): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const filtered: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Skip hidden fields
    if (hiddenFields.includes(key)) {
      continue
    }

    // Recursively filter nested objects and arrays
    if (recursive && value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        filtered[key] = value.map(item =>
          isPlainObject(item)
            ? filterObjectHiddenFields(item, hiddenFields, recursive)
            : item
        )
      } else if (isPlainObject(value)) {
        // Only recursively filter plain objects, not Date, RegExp, etc.
        filtered[key] = filterObjectHiddenFields(value, hiddenFields, recursive)
      } else {
        // Preserve special object types (Date, RegExp, etc.) as-is
        filtered[key] = value
      }
    } else {
      filtered[key] = value
    }
  }

  return filtered
}

/**
 * Filter hidden fields from results (single object or array)
 * Recursively filters nested relations as well
 */
export function filterHiddenFields<T = any>(
  data: T | T[],
  context: HandlerContext,
  recursive: boolean = true
): T | T[] {
  const hiddenFields = getHiddenFields(context)

  // No hidden fields configured
  if (hiddenFields.length === 0) {
    return data
  }

  // Handle array of results
  if (Array.isArray(data)) {
    return data.map(item =>
      filterObjectHiddenFields(item as any, hiddenFields, recursive)
    ) as T[]
  }

  // Handle single result
  return filterObjectHiddenFields(data as any, hiddenFields, recursive) as T
}

/**
 * Check if a field is hidden
 */
export function isFieldHidden(fieldName: string, context: HandlerContext): boolean {
  const hiddenFields = getHiddenFields(context)
  return hiddenFields.includes(fieldName)
}
