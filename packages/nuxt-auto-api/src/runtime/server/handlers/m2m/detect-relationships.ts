import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getM2MRelationshipsForResource } from '../../utils/m2m/detectJunctions'

/**
 * Detect M2M relationships for a resource
 * GET /api/_m2m/detect/:resource
 *
 * Returns M2M relationships with config (label, displayField, etc.)
 * Used by admin module to auto-generate M2M field configs
 */
export default defineEventHandler(async (event) => {
  const resourceName = getRouterParam(event, 'resource')

  if (!resourceName) {
    throw createError({
      statusCode: 400,
      message: 'Resource name is required',
    })
  }

  // Get runtime config for M2M configuration
  const config = useRuntimeConfig(event)
  const m2mConfig = config.autoApi?.m2m

  // Get registry and schema
  const { registry } = await import('#nuxt-auto-api-registry') as any

  // Build schema from registry
  const schema: Record<string, any> = {}
  for (const [name, config] of Object.entries(registry)) {
    schema[name] = config.schema
  }

  // Get explicit config for this resource
  const resourceM2MConfig = m2mConfig?.relations?.[resourceName] || {}

  // Check if auto-detection is enabled
  const autoDetectEnabled = m2mConfig?.autoDetect !== false

  // Start with explicit config
  const relationships: any[] = []

  // Add explicitly configured relations
  for (const [relationName, relationConfig] of Object.entries(resourceM2MConfig)) {
    relationships.push({
      relatedResource: relationName,
      junction: {
        tableName: relationConfig.junctionTable,
        leftKey: relationConfig.leftKey,
        rightKey: relationConfig.rightKey,
        metadataColumns: relationConfig.metadataColumns || [],
      },
      // Include config for admin UI
      label: relationConfig.label,
      help: relationConfig.help,
      displayField: relationConfig.displayField,
      direction: 'left', // Assume left for explicit config
    })
  }

  // If auto-detection is enabled, add auto-detected relations
  if (autoDetectEnabled) {
    const autoDetected = getM2MRelationshipsForResource(resourceName, schema)
    const explicitRelationNames = new Set(Object.keys(resourceM2MConfig))

    // Add auto-detected relations that aren't explicitly configured
    for (const rel of autoDetected) {
      if (!explicitRelationNames.has(rel.relatedResource)) {
        relationships.push({
          relatedResource: rel.relatedResource,
          junction: {
            tableName: rel.junction.tableName,
            leftKey: rel.junction.leftKey,
            rightKey: rel.junction.rightKey,
            metadataColumns: rel.junction.metadataColumns,
          },
          direction: rel.direction,
          // No label/help/displayField for auto-detected (will use defaults)
        })
      }
    }
  }

  return {
    resource: resourceName,
    relationships,
  }
})
