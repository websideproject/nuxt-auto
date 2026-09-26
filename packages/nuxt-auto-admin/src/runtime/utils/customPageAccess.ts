const ACTIONS = {
  create: 'canCreate',
  read: 'canRead',
  update: 'canUpdate',
  delete: 'canDelete',
  restore: 'canRestore',
  purge: 'canPurge',
} as const

type ResourcePermissions = Partial<Record<(typeof ACTIONS)[keyof typeof ACTIONS], boolean>>

/**
 * Whether the caller's API permissions (`GET /api/permissions`) grant every `'<resource>:<action>'` a custom page
 * requires. An entry in any other form grants nothing — a typo hides the page instead of opening it.
 */
export function grantsAll(permissions: Record<string, ResourcePermissions> | undefined, required: string | string[] | undefined): boolean {
  const list = required === undefined ? [] : Array.isArray(required) ? required : [required]
  return list.every((entry) => {
    const [resource, action, ...rest] = String(entry).split(':')
    const key = ACTIONS[action as keyof typeof ACTIONS]
    return rest.length === 0 && !!resource && !!key && permissions?.[resource]?.[key] === true
  })
}
