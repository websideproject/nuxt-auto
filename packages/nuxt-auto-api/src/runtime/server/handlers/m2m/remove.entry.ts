import { m2mRemoveHandler } from './remove'
import { defineResourceRoute } from '../pipeline'

/** M2M route — permissions for both sides are checked by the handler (see ./shared.ts). */
export default defineResourceRoute('m2m', m2mRemoveHandler, { authorize: async () => {} })
