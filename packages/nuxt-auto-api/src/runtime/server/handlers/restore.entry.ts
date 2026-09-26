import { restoreHandler } from './restore'
import { defineResourceRoute } from './pipeline'

/**
 * POST /api/{resource}/:id/restore — gated by the `restore` permission
 * (`permissions.restore` → `softDelete.restore` → `update`), which the handler checks before any lookup.
 */
export default defineResourceRoute('update', restoreHandler, { validate: false, authorize: async () => {} })
