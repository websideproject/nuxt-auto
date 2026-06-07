// Marker column candidates (the timestamp that flips a row to "trashed").
const MARKER_CANDIDATES = ['deletedAt', 'deleted_at', 'deletedDate'] as const
// Companion columns the softDelete() preset registers alongside the marker. Their presence is a
// strong signal the marker is a real soft-delete column (not a domain `deleted_at` like the privacy
// tables' "when the subject was erased", which is NOT NULL and has no companions).
const COMPANION_CANDIDATES = [
  'deletedBy', 'deleted_by', 'deletionId', 'deletion_id', 'deletedReason', 'deleted_reason',
] as const

/**
 * Detect the soft-delete marker column on a table, or null if the table is not soft-deletable.
 *
 * A `deleted_at`-style column counts as a soft-delete marker only when it is **nullable** (live rows
 * have NULL) OR a preset **companion** column (`deletion_id`/`deleted_reason`/`deleted_by`) is present.
 * This excludes domain `deleted_at` columns that are NOT NULL with no companions (e.g. the privacy
 * tombstone/erasure tables, where `deleted_at` means "when the subject was erased").
 */
export function getSoftDeleteColumn(table: any): string | null {
  if (!table) return null
  const columns = Object.keys(table)

  const marker = MARKER_CANDIDATES.find(c => columns.includes(c))
  if (!marker) return null

  const hasCompanion = COMPANION_CANDIDATES.some(c => columns.includes(c))
  if (hasCompanion) return marker

  // No companion → only treat as soft-delete if the marker column is nullable.
  // drizzle columns expose `.notNull` (boolean). Be defensive if it's missing.
  const col = table[marker]
  const isNotNull = col?.notNull === true
  return isNotNull ? null : marker
}

/**
 * Return the present soft-delete companion columns (property names on the table) so restore/cascade
 * can clear them generically, e.g. `['deletedBy','deletionId','deletedReason']`.
 */
export function getSoftDeleteCompanions(table: any): string[] {
  if (!table) return []
  const columns = Object.keys(table)
  return COMPANION_CANDIDATES.filter(c => columns.includes(c))
}

/**
 * Check if resource supports soft delete. Explicit config (`softDelete: false` or a string[] allow
 * list) overrides; otherwise auto-detect by column (see getSoftDeleteColumn).
 */
export function supportsSoftDelete(
  resource: string,
  table: any,
  config?: { softDelete?: boolean | string[] },
): boolean {
  if (config?.softDelete === false) return false
  if (Array.isArray(config?.softDelete) && !config.softDelete.includes(resource)) return false
  return getSoftDeleteColumn(table) !== null
}

/**
 * Build the `.set({...})` payload that marks a row as soft-deleted: the marker timestamp plus every
 * present companion (`deletedBy`/`deletionId`/`deletedReason`). Used by delete, bulk delete, and the
 * cascade so all paths stamp identically. `reason` is only written when both supplied and supported.
 */
export function buildSoftDeleteUpdates(
  table: any,
  opts: { deletionId?: string | null, reason?: string | null, userId?: string | null } = {},
): Record<string, any> {
  const marker = getSoftDeleteColumn(table)
  if (!marker) return {}
  const updates: Record<string, any> = { [marker]: new Date() }
  for (const c of getSoftDeleteCompanions(table)) {
    if (c === 'deletedBy' || c === 'deleted_by') updates[c] = opts.userId ?? null
    else if (c === 'deletionId' || c === 'deletion_id') updates[c] = opts.deletionId ?? null
    else if ((c === 'deletedReason' || c === 'deleted_reason') && opts.reason != null) updates[c] = opts.reason
  }
  return updates
}

/**
 * Build the `.set({...})` payload that restores a soft-deleted row: clears the marker and every
 * present companion column.
 */
export function buildRestoreUpdates(table: any): Record<string, any> {
  const marker = getSoftDeleteColumn(table)
  if (!marker) return {}
  const updates: Record<string, any> = { [marker]: null }
  for (const c of getSoftDeleteCompanions(table)) updates[c] = null
  return updates
}

/**
 * Whether the current request may SEE soft-deleted rows. Async — `viewDeleted` config can be a
 * string / array / function / object (gate descriptor), evaluated through the shared permission
 * resolver (so plan/entitlement gates work). Falls back to global admin OR org admin/owner.
 *
 * `evaluatePermission` is imported lazily to avoid a require cycle (permissions.ts ↔ softDelete.ts).
 */
export async function canViewSoftDeleted(context: any): Promise<boolean> {
  const perms: string[] = context.permissions ?? []
  if (perms.includes('admin') || perms.includes('*')) return true

  const authz = (context.resourceConfig as any)?.authorization
  const viewDeleted = authz?.permissions?.viewDeleted ?? authz?.softDelete?.viewDeleted
  if (viewDeleted !== undefined) {
    const { evaluatePermission } = await import('./permissions')
    if (await evaluatePermission(viewDeleted, context)) return true
  }

  // Org-role fallback (requestMeta stamped by the better-auth plugin).
  const orgRoles: string[] = (context as any).requestMeta?.orgRoles ?? []
  return orgRoles.some((r: string) => ['admin', 'owner'].includes(r))
}
