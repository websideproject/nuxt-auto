import { useRuntimeConfig } from 'nitropack/runtime'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getM2MRelationshipsForResource } from '../../utils/m2m/detectJunctions'
import { createCallerContext } from '../createContextFromRegistry'
import { getAuthConfig } from '../../utils/authConfig'
import { assertPermission } from '../../utils/permissions'
import { junctionDiscoveryTables } from './shared'

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
  // Discovery reveals schema structure: only for callers who may read the resource.
  const caller = await createCallerContext(event)
  if (!caller.registry?.[resourceName]) throw createError({ statusCode: 404, message: `Resource "${resourceName}" not found` })
  const target = { ...caller, resource: resourceName }
  await assertPermission('read', getAuthConfig(target, resourceName), target, resourceName)

  const m2mConfig = (useRuntimeConfig(event) as any).autoApi?.m2m

  // Get explicit config for this resource
  const resourceM2MConfig = m2mConfig?.relations?.[resourceName] || {}

  // Check if auto-detection is enabled
  const autoDetectEnabled = m2mConfig?.autoDetect !== false

  const { tables, resourceNames } = junctionDiscoveryTables(caller)
  const autoDetected = autoDetectEnabled ? getM2MRelationshipsForResource(resourceName, tables, resourceNames) : []
  const junctionOf = (rel: typeof autoDetected[number]) => ({
    tableName: rel.junction.tableName,
    leftKey: rel.junction.leftKey,
    rightKey: rel.junction.rightKey,
    metadataColumns: rel.junction.metadataColumns,
  })

  // Start with explicit config
  const relationships: any[] = []

  // Add explicitly configured relations. One configured with labels only takes the detected junction.
  for (const [relationName, relationConfig] of Object.entries(resourceM2MConfig as Record<string, any>)) {
    const detected = relationConfig.junctionTable ? undefined : autoDetected.find(rel => rel.relatedResource === relationName)
    relationships.push({
      relatedResource: relationName,
      junction: detected
        ? { ...junctionOf(detected), metadataColumns: relationConfig.metadataColumns || detected.junction.metadataColumns }
        : {
            tableName: relationConfig.junctionTable,
            leftKey: relationConfig.leftKey,
            rightKey: relationConfig.rightKey,
            metadataColumns: relationConfig.metadataColumns || [],
          },
      // Include config for admin UI
      label: relationConfig.label,
      help: relationConfig.help,
      displayField: relationConfig.displayField,
      direction: detected?.direction ?? 'left', // Assume left for explicit config
    })
  }

  // Add auto-detected relations that aren't explicitly configured
  for (const rel of autoDetected) {
    if (!(rel.relatedResource in resourceM2MConfig)) {
      relationships.push({
        relatedResource: rel.relatedResource,
        junction: junctionOf(rel),
        direction: rel.direction,
        // No label/help/displayField for auto-detected (will use defaults)
      })
    }
  }

  return {
    resource: resourceName,
    relationships,
  }
})
