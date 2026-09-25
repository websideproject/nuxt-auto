import { deleteHandler } from './delete'
import { defineResourceRoute } from './pipeline'

/** DELETE /api/{resource}/:id  (`?force=true` purges a soft-deletable row) */
export default defineResourceRoute('delete', deleteHandler)
