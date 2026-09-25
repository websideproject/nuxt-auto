import { getHandler } from './get'
import { defineResourceRoute } from './pipeline'

/** GET /api/{resource}/:id */
export default defineResourceRoute('get', getHandler)
