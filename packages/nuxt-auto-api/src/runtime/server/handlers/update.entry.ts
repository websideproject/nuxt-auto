import { updateHandler } from './update'
import { defineResourceRoute } from './pipeline'

/** PATCH /api/{resource}/:id */
export default defineResourceRoute('update', updateHandler)
