import type { ActionLocation, ActionOperation, AdminActions, CustomAction } from '../types'

/** A custom action with its key and the places it appears. */
export interface ResolvedAction extends CustomAction {
  key: string
  locations: ActionLocation[]
}

/** A resource's custom actions. `bulk` and `page-level` actions only ever sit on the toolbar. */
export function actionsFor(all: AdminActions | undefined, resource: string): ResolvedAction[] {
  return Object.entries(all?.[resource] ?? {}).map(([key, action]) => ({
    ...action,
    key,
    locations: action.type === 'single' ? [action.location].flat().filter(l => l !== 'toolbar') : ['toolbar'],
  }))
}

export function actionsAt(actions: ResolvedAction[], location: ActionLocation, type: CustomAction['type']): ResolvedAction[] {
  return actions.filter(a => a.type === type && a.locations.includes(location))
}

/** The confirmation to ask before running, or null to run straight away. */
export function confirmMessage(action: CustomAction, item: unknown): string | null {
  const message = typeof action.confirm === 'function' ? action.confirm(item) : action.confirm
  return message ? String(message) : null
}

/**
 * May the caller use this action? An operation is answered by `can` (the API's answer — for a row action, that
 * row's); a function by itself. No `permission` = allowed.
 */
export function isActionAllowed(
  action: CustomAction,
  { resource, item, can }: { resource: string, item?: unknown, can: (operation: ActionOperation) => boolean },
): boolean {
  if (!action.permission) return true
  if (typeof action.permission === 'function') return !!action.permission({ resource, item })
  return can(action.permission)
}
