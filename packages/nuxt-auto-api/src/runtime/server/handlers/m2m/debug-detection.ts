import { defineEventHandler } from 'h3'
import { getTableColumns } from 'drizzle-orm'
import { detectAllJunctionTables } from '../../utils/m2m/detectJunctions'

/**
 * Debug endpoint to troubleshoot junction detection
 * GET /api/_m2m/debug-detection
 */
export default defineEventHandler(async (event) => {
  // Get registry and schema
  const { registry } = await import('#nuxt-auto-api-registry') as any

  // Build schema from registry
  const schema: Record<string, any> = {}
  const registryInfo: any = {}

  for (const [name, config] of Object.entries(registry)) {
    schema[name] = config.schema

    // Debug info for each table
    try {
      const columns = getTableColumns(config.schema)
      const columnEntries = Object.entries(columns)

      // Get foreign key references
      const foreignKeys = columnEntries.filter(([_, col]: [string, any]) => {
        return col.foreignKeys?.length > 0 || col.references
      })

      // Check for standalone ID
      const hasStandaloneId = columnEntries.some(([colName, col]: [string, any]) => {
        return colName === 'id' && !foreignKeys.find(fk => fk[0] === colName)
      })

      registryInfo[name] = {
        columnCount: columnEntries.length,
        columnNames: columnEntries.map(([n]) => n),
        foreignKeyCount: foreignKeys.length,
        foreignKeys: foreignKeys.map(([fkName, fkCol]: [string, any]) => ({
          name: fkName,
          hasReferences: !!fkCol.references,
          hasForeignKeys: !!fkCol.foreignKeys
        })),
        hasStandaloneId,
      }
    } catch (error: any) {
      registryInfo[name] = {
        error: error.message
      }
    }
  }

  // Try detection
  const detectedJunctions = detectAllJunctionTables(schema)

  return {
    registryCount: Object.keys(registry).length,
    registryTables: Object.keys(registry),
    registryInfo,
    detectedJunctions: detectedJunctions.map(j => ({
      tableName: j.tableName,
      leftResource: j.leftResource,
      rightResource: j.rightResource,
      leftKey: j.leftKey,
      rightKey: j.rightKey,
      metadataColumns: j.metadataColumns
    })),
    detectedCount: detectedJunctions.length,
  }
})
