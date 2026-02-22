import { defineEventHandler, getQuery, setHeader, createError } from 'h3'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface ExportPluginOptions {
  /** Supported export formats. @default ['csv', 'json'] */
  formats?: ('csv' | 'json')[]
  /** Maximum rows to export. @default 10000 */
  maxRows?: number
  /** Resources that support export (undefined = all) */
  resources?: string[]
}

function escapeCsvValue(value: any): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(data: any[], fields?: string[]): string {
  if (data.length === 0) return ''

  const columns = fields || Object.keys(data[0])
  const header = columns.map(escapeCsvValue).join(',')
  const rows = data.map(row =>
    columns.map(col => escapeCsvValue(row[col])).join(','),
  )

  return [header, ...rows].join('\r\n')
}

/**
 * Create a data export plugin.
 * Adds CSV/JSON export endpoints to resources.
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
  const {
    formats = ['csv', 'json'],
    maxRows = 10000,
    resources,
  } = options

  return defineAutoApiPlugin({
    name: 'export',
    version: '1.0.0',
    buildSetup(ctx) {
      // We register a catch-all handler that checks resource dynamically
      ctx.addServerHandler({
        route: '/api/:resource/export',
        method: 'get',
        handler: defineEventHandler(async (event) => {
          const resource = event.context.params?.resource as string
          if (!resource) {
            throw createError({ statusCode: 400, message: 'Resource is required' })
          }

          // Check if resource is allowed
          if (resources && !resources.includes(resource)) {
            throw createError({ statusCode: 403, message: `Export not enabled for ${resource}` })
          }

          const { registry } = await (import('#nuxt-auto-api-registry') as any)
          const { getDatabaseAdapter } = await import('../server/database')

          const resourceConfig = (registry as any)[resource]
          if (!resourceConfig) {
            throw createError({ statusCode: 404, message: `Resource "${resource}" not found` })
          }

          const adapter = getDatabaseAdapter()
          const db = adapter.db
          const table = resourceConfig.schema

          const query = getQuery(event)
          const format = (query.format as string) || 'json'

          if (!formats.includes(format as any)) {
            throw createError({ statusCode: 400, message: `Unsupported format: ${format}. Supported: ${formats.join(', ')}` })
          }

          const limit = Math.min(Number(query.limit) || maxRows, maxRows)

          // Parse fields
          let fields: string[] | undefined
          if (query.fields) {
            fields = String(query.fields).split(',').map(f => f.trim())
          }

          // Query data
          const data = await db.select().from(table).limit(limit)

          // Filter fields if specified
          let exportData = data
          if (fields) {
            exportData = data.map((row: any) => {
              const filtered: any = {}
              for (const field of fields!) {
                if (field in row) filtered[field] = row[field]
              }
              return filtered
            })
          }

          if (format === 'csv') {
            const csv = toCsv(exportData, fields)
            setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
            setHeader(event, 'Content-Disposition', `attachment; filename="${resource}-export.csv"`)
            return csv
          }

          // JSON format
          setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
          setHeader(event, 'Content-Disposition', `attachment; filename="${resource}-export.json"`)
          return { data: exportData, meta: { total: exportData.length, format: 'json' } }
        }),
      })
    },
    runtimeSetup(ctx) {
      ctx.logger.info(`Export enabled (${formats.join(', ')}) for: ${resources?.join(', ') || 'all resources'}`)
    },
  })
}
