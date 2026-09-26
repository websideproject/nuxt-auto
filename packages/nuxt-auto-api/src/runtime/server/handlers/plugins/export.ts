import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { authorizedContext, routeResource } from '../../utils/pluginRoutes'
import { toCsv } from '../../utils/csv'
import { listHandler } from '../list'

/**
 * GET /api/{resource}/export?format=csv|json — createExportPlugin.
 *
 * An export is the resource's list, page after page: the same caller, tenant, `read` permission, row
 * visibility, hidden and readable fields, and the same `filter` / `sort` / `fields` parameters. Up to `maxRows`.
 */
export default defineEventHandler(async (event) => {
  const cfg = (useRuntimeConfig(event) as any).autoApiPluginRoutes?.export ?? {}
  const formats: string[] = cfg.formats ?? ['csv', 'json']
  const maxRows: number = cfg.maxRows ?? 10000
  const resource = routeResource(event)

  const query = getQuery(event)
  const format = String(query.format || 'json')
  if (!formats.includes(format)) {
    throw createError({ statusCode: 400, message: `Unsupported format: ${format}. Supported: ${formats.join(', ')}` })
  }
  const limit = Math.min(Number(query.limit) || maxRows, maxRows)

  const context = await authorizedContext(event, resource, 'list')
  const pageSize = (context.runtimeConfig as any)?.autoApi?.pagination?.maxLimit ?? 100
  const { limit: _l, page: _p, cursor: _c, format: _f, ...listQuery } = (context.validated.query ?? context.query) as Record<string, any>
  const rows: any[] = []
  let cursor = ''
  while (rows.length < limit) {
    context.validated = { ...context.validated, query: { ...listQuery, limit: Math.min(pageSize, limit - rows.length), cursor } }
    const page = await listHandler(context)
    rows.push(...(page.data as any[]))
    if (!page.meta?.nextCursor) break
    cursor = page.meta.nextCursor
  }

  if (format === 'csv') {
    const fields = listQuery.fields ? String(listQuery.fields).split(',').map(f => f.trim()).filter(Boolean) : undefined
    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="${resource}-export.csv"`)
    return toCsv(rows, fields)
  }
  setHeader(event, 'Content-Disposition', `attachment; filename="${resource}-export.json"`)
  return { data: rows, meta: { total: rows.length, format: 'json' } }
})
