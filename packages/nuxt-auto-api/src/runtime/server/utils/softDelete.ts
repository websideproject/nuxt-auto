/**
 * Check if table has soft delete column
 */
export function getSoftDeleteColumn(table: any): string | null {
  if (!table) return null

  const columns = Object.keys(table)

  // Check common soft delete column names
  if (columns.includes('deletedAt')) return 'deletedAt'
  if (columns.includes('deleted_at')) return 'deleted_at'
  if (columns.includes('deletedDate')) return 'deletedDate'

  return null
}

/**
 * Check if resource supports soft delete
 * Checks both schema and config
 */
export function supportsSoftDelete(
  resource: string,
  table: any,
  config?: { softDelete?: boolean | string[] }
): boolean {
  // Explicit config overrides
  if (config?.softDelete === false) return false
  if (Array.isArray(config?.softDelete) && !config.softDelete.includes(resource)) return false

  // Auto-detect by column
  return getSoftDeleteColumn(table) !== null
}
