import { m2mAddHandler } from './add'
import { defineResourceRoute } from '../pipeline'

/** M2M route — permissions for both sides are checked by the handler (see ./shared.ts). */
export default defineResourceRoute('m2m', m2mAddHandler, { authorize: async () => {} })
