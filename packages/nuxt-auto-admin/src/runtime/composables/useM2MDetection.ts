import type { FieldConfig } from '../types'

export interface M2MFieldConfig extends FieldConfig {
  name: string
  label: string
  widget: 'MultiRelationSelect'
  options: {
    resource: string
    displayField: string
    junctionTable?: string
    junctionLeftKey?: string
    junctionRightKey?: string
  }
}

/**
 * Auto-generate M2M field configurations from detected relationships
 *
 * This composable:
 * 1. Detects M2M relationships from the schema
 * 2. Generates field configs for M2MRelationCard
 * 3. Can be merged with manual field configs
 */
export function useM2MDetection() {
  /**
   * Detect M2M relationships for a resource from the API registry
   */
  async function detectM2MFields(resourceName: string): Promise<M2MFieldConfig[]> {
    try {
      // Call the auto-api utility to get M2M relationships with config
      const response = await $fetch<{
        relationships: Array<{
          relatedResource: string
          junction: {
            tableName: string
            leftKey: string
            rightKey: string
          }
          label?: string
          help?: string
          displayField?: string
        }>
      }>(`/api/_m2m/detect/${resourceName}`)

      // Convert to field configs
      return response.relationships.map(rel => ({
        name: rel.relatedResource,
        // Use configured label or generate from resource name
        label: rel.label || formatLabel(rel.relatedResource),
        widget: 'MultiRelationSelect' as const,
        // Use configured help text if provided
        help: rel.help,
        options: {
          resource: rel.relatedResource,
          // Use configured displayField or default to 'name'
          displayField: rel.displayField || 'name',
          // Auto-detected junction info (optional, for backward compatibility)
          junctionTable: rel.junction.tableName,
          junctionLeftKey: rel.junction.leftKey,
          junctionRightKey: rel.junction.rightKey,
        },
      }))
    } catch (error) {
      console.warn(`[useM2MDetection] Failed to detect M2M fields for ${resourceName}:`, error)
      return []
    }
  }

  /**
   * Merge auto-detected fields with manual config
   *
   * Manual config takes precedence
   */
  function mergeM2MFields(
    autoDetected: M2MFieldConfig[],
    manualConfig: FieldConfig[] = []
  ): FieldConfig[] {
    const result: FieldConfig[] = [...manualConfig]
    const manualFieldNames = new Set(manualConfig.map(f => f.name))

    // Add auto-detected fields that aren't manually configured
    for (const field of autoDetected) {
      if (!manualFieldNames.has(field.name)) {
        result.push(field)
      }
    }

    return result
  }

  /**
   * Format resource name to human-readable label
   */
  function formatLabel(resourceName: string): string {
    // Convert camelCase or snake_case to Title Case
    return resourceName
      .replace(/([A-Z])/g, ' $1') // camelCase to spaces
      .replace(/_/g, ' ') // snake_case to spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim()
  }

  return {
    detectM2MFields,
    mergeM2MFields,
    formatLabel,
  }
}

/**
 * Check if a resource is a junction table
 *
 * Junction tables should be hidden from the sidebar
 */
export async function isJunctionTable(resourceName: string): Promise<boolean> {
  try {
    const response = await $fetch<{ isJunction: boolean }>(
      `/api/_m2m/is-junction/${resourceName}`
    )
    return response.isJunction
  } catch (error) {
    return false
  }
}

/**
 * Get all junction table names (for filtering sidebar)
 */
export async function getJunctionTableNames(): Promise<string[]> {
  try {
    const response = await $fetch<{ junctions: string[] }>('/api/_m2m/junctions')
    return response.junctions
  } catch (error) {
    console.warn('[useM2MDetection] Failed to get junction tables:', error)
    return []
  }
}
