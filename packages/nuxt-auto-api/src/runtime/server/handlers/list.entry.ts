import { listHandler } from './list'
import { defineResourceRoute } from './pipeline'

/** GET /api/{resource} */
export default defineResourceRoute('list', listHandler)
