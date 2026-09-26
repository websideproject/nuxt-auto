import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { createError, defineEventHandler, getRouterParam, readMultipartFormData } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { authorizedContext, routeResource } from '../../utils/pluginRoutes'
import { findAuthorizedRow } from '../../utils/rowAccess'
import { assertWritableFields, filterReadableFields } from '../../utils/fieldPermissions'
import { filterHiddenFields } from '../../utils/filterHiddenFields'
import { updateReturning } from '../../utils/returning'
import { serializeResponse } from '../../utils/serializeResponse'
import { primaryKeyName } from '../../utils/table'

interface UploadConfig { field: string, maxSize?: string, accept?: string[], path?: string }

function parseSize(size: string): number {
  const match = size.match(/^(\d+)(kb|mb|gb)$/i)
  if (!match) return 5 * 1024 * 1024
  return Number.parseInt(match[1]!) * ({ kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 } as Record<string, number>)[match[2]!.toLowerCase()]!
}

function matchesMime(type: string, patterns: string[]): boolean {
  return patterns.some(p => p === '*' || p === '*/*' || (p.endsWith('/*') ? type.startsWith(p.slice(0, -1)) : type === p))
}

/**
 * POST / DELETE /api/{resource}/:id/upload — createFileUploadPlugin.
 *
 * Writing a file is an update of the record: the caller needs `update` on the resource, the row must be
 * visible to them (tenant, listFilter, objectLevel) and they must be allowed to write the file column. Stored
 * names are server-generated; deleting only ever removes a file inside the upload directory.
 */
export default defineEventHandler(async (event) => {
  const cfg = (useRuntimeConfig(event) as any).autoApiPluginRoutes?.fileUpload ?? {}
  const resource = routeResource(event)
  const upload: UploadConfig | undefined = cfg.resources?.[resource]
  if (!upload) throw createError({ statusCode: 404, message: `Uploads are not enabled for ${resource}` })

  const context = await authorizedContext(event, resource, 'update')
  const existing = await findAuthorizedRow(context, resource, getRouterParam(event, 'id')!)
  await assertWritableFields({ [upload.field]: null }, context)
  const table = context.schema[resource]
  const id = existing[primaryKeyName(table)]

  const storagePath = String(upload.path || resource).replace(/[^\w-]/g, '_')
  const root = resolve(process.cwd(), cfg.localDir || 'server/uploads')
  const urlPrefix = `/uploads/${storagePath}/`

  let url: string | null = null
  if (event.method === 'DELETE') {
    const current = existing[upload.field]
    if (cfg.storage === 'local' && typeof current === 'string' && current.startsWith(urlPrefix)) {
      const file = resolve(root, current.slice('/uploads/'.length))
      if (file.startsWith(root + sep)) await unlink(file).catch(() => {})
    }
  }
  else {
    const file = (await readMultipartFormData(event))?.find(part => part.filename && part.data)
    if (!file) throw createError({ statusCode: 400, message: 'No file uploaded' })
    if (file.data.length > parseSize(upload.maxSize || '5mb')) {
      throw createError({ statusCode: 413, message: `File too large. Max: ${upload.maxSize || '5mb'}` })
    }
    if (upload.accept && !matchesMime(file.type || '', upload.accept)) {
      throw createError({ statusCode: 415, message: `File type not accepted. Allowed: ${upload.accept.join(', ')}` })
    }
    const ext = /\.([a-z0-9]{1,10})$/i.exec(file.filename!)?.[1]?.toLowerCase() ?? 'bin'
    const name = `${randomUUID()}.${ext}`

    if (cfg.storage === 'local') {
      const dir = resolve(root, storagePath)
      await mkdir(dir, { recursive: true })
      await writeFile(resolve(dir, name), file.data)
      url = `${urlPrefix}${name}`
    }
    else {
      const { hubBlob } = await import('#imports' as any).catch(() => ({}))
      if (!hubBlob) throw createError({ statusCode: 500, message: 'Blob storage not available' })
      const blob = await hubBlob().put(name, file.data, { prefix: storagePath, contentType: file.type })
      url = blob.pathname || blob.url
    }
  }

  const updated = await updateReturning(context.db, table, id, { [upload.field]: url })
  const out = await filterReadableFields(filterHiddenFields(updated, context), context)
  return { data: serializeResponse(out) }
})
