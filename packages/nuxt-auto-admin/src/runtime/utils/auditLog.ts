export interface AuditEntry {
  id?: string | number
  operation?: string
  userId?: string | null
  before?: unknown
  after?: unknown
  timestamp?: string | number
}

/** A snapshot column: the plugin stores JSON text; a `mode: 'json'` column arrives parsed. */
function snapshot(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : null
    }
    catch {
      return null
    }
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

/** The fields an update changed (those whose value differs); none for a create or delete. */
export function changedFields(entry: AuditEntry): string[] {
  const before = snapshot(entry.before)
  const after = snapshot(entry.after)
  if (!before || !after) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}
