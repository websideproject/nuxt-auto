import type { AdminActions } from '../types'

/**
 * Custom actions per resource, for the app's `admin.actions.ts`:
 *
 * ```ts
 * export default defineAdminActions({
 *   posts: {
 *     publish: { label: 'Publish', type: 'single', location: 'row', permission: 'update', handler: async (post, ctx) => { … } },
 *   },
 * })
 * ```
 */
export function defineAdminActions<T extends AdminActions>(actions: T): T {
  return actions
}
