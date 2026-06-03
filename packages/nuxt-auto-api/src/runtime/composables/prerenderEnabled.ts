import { computed, unref } from 'vue'

/**
 * Auto-api queries always hit the DB, so they can never resolve during prerender (build time,
 * there is no DB binding) — the request handler throws "Database not initialized" and fails the
 * prerendered page. This wraps a query's `enabled` so it is forced OFF during prerender while
 * preserving the caller's intent everywhere else: at real SSR runtime (`import.meta.prerender`
 * is `false`) and on the client the query behaves exactly as before, then hydrates client-side.
 *
 * @param userEnabled  The caller-provided `enabled` (boolean | ref | getter | undefined).
 * @param fallback     The composable's own default when the caller didn't pass `enabled`
 *                     (e.g. `() => !!id` for by-id queries). Defaults to always-enabled.
 */
export function prerenderSafeEnabled(
  userEnabled?: unknown,
  fallback: () => boolean = () => true,
) {
  return computed(() => {
    if (import.meta.prerender) return false
    if (userEnabled !== undefined) {
      const e = typeof userEnabled === 'function' ? userEnabled() : unref(userEnabled as any)
      return (e ?? fallback()) as boolean
    }
    return fallback()
  })
}
