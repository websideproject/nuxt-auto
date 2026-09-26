import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

/**
 * Built-in plugin that stamps `createdBy` / `updatedBy` from the request user.
 *
 * Activated automatically when a table has those columns (detected by name).
 * Does not require configuration — just add `...audit()` from the dialect preset.
 *
 * Rules:
 * - `createdBy` is only set on create (null = system/task, no auth).
 * - `updatedBy` is overwritten on every create + update (server-controlled; client value is ignored).
 * - Raw drizzle writes (privacy erasure, migrations, tasks) bypass this — intended.
 */
export function createAuditStampPlugin(): AutoApiPlugin {
  function userId(ctx: any): string | null {
    return ctx.user?.id != null ? String(ctx.user.id) : null
  }

  return defineAutoApiPlugin({
    name: 'audit-stamp',
    version: '1.0.0',
    runtimeSetup(ctx) {
      ctx.addGlobalHook({
        beforeCreate(data: any, c: any) {
          const t = c.schema[c.resource]
          if (!t) return data
          const uid = userId(c)
          if ('createdBy' in t && (data.createdBy == null || data.createdBy === undefined)) {
            data.createdBy = uid
          }
          if ('updatedBy' in t) {
            data.updatedBy = uid
          }
          return data
        },
        beforeUpdate(_id: any, data: any, c: any) {
          const t = c.schema[c.resource]
          if (t && 'updatedBy' in t) {
            data.updatedBy = userId(c)
          }
          return data
        },
      })
    },
  })
}
