import { pluginFromFactory } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'
import { registerPluginRoutes } from './pluginRoutes'

export interface ExportPluginOptions {
  /** Supported export formats. @default ['csv', 'json'] */
  formats?: ('csv' | 'json')[]
  /** Maximum rows to export. @default 10000 */
  maxRows?: number
  /** Resources that support export (undefined = all) */
  resources?: string[]
}

/**
 * Create a data export plugin.
 * Adds `GET /api/:resource/export?format=csv|json`: the resource's list — same authorization, row visibility,
 * hidden fields, `filter` / `sort` / `fields` — without the page size limit, up to `maxRows`. CSV cells that
 * would run as spreadsheet formulas are neutralised.
 *
 * @example
 * ```ts
 * createExportPlugin({
 *   formats: ['csv', 'json'],
 *   maxRows: 5000,
 *   resources: ['users', 'orders'],
 * })
 * ```
 */
export function createExportPlugin(options: ExportPluginOptions = {}): AutoApiPlugin {
  const { formats = ['csv', 'json'], maxRows = 10000, resources } = options

  return pluginFromFactory('createExportPlugin', [options], {
    name: 'export',
    version: '1.1.0',
    buildSetup(ctx) {
      // GET /api/{resource}/export — authorized like the resource's list (runtime/server/handlers/plugins/export.ts).
      // `resources` travels with the config so nuxt-auto-admin knows which lists have the route.
      registerPluginRoutes(ctx, 'export', { formats, maxRows, resources }, [], [{ path: '/export', method: 'get', handler: 'export', resources }])
    },
    runtimeSetup(ctx) {
      ctx.logger.info(`Export enabled (${formats.join(', ')}) for: ${resources?.join(', ') || 'all resources'}`)
    },
  })
}
