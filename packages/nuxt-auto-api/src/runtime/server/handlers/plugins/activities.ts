import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { logFeed } from './logFeed'

/** GET /api/activities — createActivityFeedPlugin. See logFeed. */
export default defineEventHandler(event => logFeed(event, (useRuntimeConfig(event) as any).autoApiPluginRoutes?.activityFeed?.table))
