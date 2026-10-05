import { reactive } from 'vue'
import actionsMap from '#nuxt-auto-admin-actions'
import { useAutoApiPath } from '@websideproject/nuxt-auto-api/composables'
import type { ActionContext } from '../types'
import { apiErrorMessage } from '../utils/apiErrors'
import { actionsAt, actionsFor, confirmMessage } from '../utils/customActions'
import type { ResolvedAction } from '../utils/customActions'
// Explicit: Nuxt does not auto-import into files inside node_modules, which is where this module runs from.
import { useNuxtApp } from '#app'
import { useToast } from '#imports'

/**
 * A resource's custom actions (from the app's `admin.actions.ts`), grouped by where they appear, and `run()`:
 * asks the action's `confirm` first (see `pending` / `confirm()`), then calls its handler with the context.
 */
export function useAdminCustomActions(resourceName: string) {
  const nuxtApp = useNuxtApp()
  const toast = useToast()
  const apiPath = useAutoApiPath()
  const all = actionsFor(actionsMap, resourceName)

  const context: ActionContext = {
    resource: resourceName,
    // Every list and record of the resource (nuxt-auto-api keys them under ['autoapi', resource]).
    refresh: async () => {
      await (nuxtApp.$queryClient as { invalidateQueries: (filters: { queryKey: unknown[] }) => Promise<void> })
        .invalidateQueries({ queryKey: ['autoapi', resourceName] })
    },
    toast: {
      success: message => toast.add({ title: message, icon: 'i-heroicons-check-circle', color: 'success' }),
      error: (message, error) => toast.add({ title: message, ...(error ? { description: apiErrorMessage(error) } : {}), icon: 'i-heroicons-exclamation-circle', color: 'error' }),
    },
    path: (...segments) => apiPath(resourceName, ...segments),
  }

  const pending = reactive({
    open: false,
    running: false,
    message: '',
    action: null as ResolvedAction | null,
    item: undefined as unknown,
  })

  async function execute(action: ResolvedAction, item: unknown) {
    try {
      await action.handler(item, context)
    }
    catch (err) {
      // A handler is meant to report its own errors; this is the net for one that does not.
      context.toast.error(`${action.label} failed`, err)
    }
  }

  async function run(action: ResolvedAction, item?: unknown) {
    const message = confirmMessage(action, item)
    if (message) {
      Object.assign(pending, { open: true, running: false, message, action, item })
      return
    }
    await execute(action, item)
  }

  /** Runs the action waiting on its confirmation. */
  async function confirm() {
    if (!pending.action) return
    pending.running = true
    try {
      await execute(pending.action, pending.item)
    }
    finally {
      Object.assign(pending, { open: false, running: false, action: null, item: undefined })
    }
  }

  /** Drops the action waiting on its confirmation (not while it runs). */
  function cancel() {
    if (!pending.running) Object.assign(pending, { open: false, action: null, item: undefined })
  }

  return {
    rowActions: actionsAt(all, 'row', 'single'),
    detailActions: actionsAt(all, 'detail', 'single'),
    bulkActions: actionsAt(all, 'toolbar', 'bulk'),
    pageActions: actionsAt(all, 'toolbar', 'page-level'),
    run,
    pending,
    confirm,
    cancel,
  }
}
