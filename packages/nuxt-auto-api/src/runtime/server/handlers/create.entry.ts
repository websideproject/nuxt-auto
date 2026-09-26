import { createHandler } from './create'
import { defineResourceRoute } from './pipeline'

/** POST /api/{resource} */
export default defineResourceRoute('create', createHandler)
