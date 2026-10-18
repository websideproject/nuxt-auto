import { defineTask, useRuntimeConfig } from 'nitropack/runtime'
import { purgeExpiredTrash } from '../utils/softDeleteRetention'

/**
 * `auto-api:purge-trash` — hard-deletes trashed rows older than each resource's `softDelete.retentionDays`.
 * Scheduled by `autoApi.trashPurge.schedule`; run it by hand with `npx nuxi task run auto-api:purge-trash`.
 */
export default defineTask({
  meta: {
    name: 'auto-api:purge-trash',
    description: 'Hard-delete soft-deleted rows past their retention (softDelete.retentionDays)',
  },
  async run() {
    return { result: await purgeExpiredTrash({ runtimeConfig: useRuntimeConfig() }) }
  },
})
