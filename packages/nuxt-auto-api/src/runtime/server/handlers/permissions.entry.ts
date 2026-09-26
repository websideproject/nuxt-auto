import { permissionsHandler } from './permissions'
import { defineResourceRoute } from './pipeline'

/**
 * GET /api/{resource}/permissions — what the caller may do on this resource. Open to every caller (it
 * answers "may I?", and the answer for an anonymous caller is usually "no").
 */
export default defineResourceRoute('get', permissionsHandler, { validate: false, authorize: async () => {} })
