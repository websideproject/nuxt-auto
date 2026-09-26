import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { logFeed } from './logFeed'

/** GET /api/audit-logs — createAuditLogPlugin. See logFeed. */
export default defineEventHandler(event => logFeed(event, (useRuntimeConfig(event) as any).autoApiPluginRoutes?.auditLog?.table))
