import { describe, it, expect } from 'vitest'
import { adminApiInfo } from '../../src/module'

describe('adminApiInfo (what the API offers the admin, read at build time)', () => {
  it('defaults: bulk on, no plugin routes', () => {
    expect(adminApiInfo(undefined, undefined)).toEqual({ maxLimit: 100, bulk: true, maxBatchSize: 100, export: null, auditLog: false })
  })

  it('reads the page and batch limits and whether bulk is disabled', () => {
    expect(adminApiInfo({ pagination: { maxLimit: 50 }, bulk: { enabled: false, maxBatchSize: 25 } }, {}))
      .toMatchObject({ maxLimit: 50, bulk: false, maxBatchSize: 25 })
  })

  it('sees the routes createExportPlugin and createAuditLogPlugin registered', () => {
    const info = adminApiInfo({}, { export: { formats: ['csv'], maxRows: 500, resources: ['posts'] }, auditLog: { table: 'auditLogs' } })
    expect(info.export).toEqual({ formats: ['csv'], maxRows: 500, resources: ['posts'] })
    expect(info.auditLog).toBe(true)
    expect(adminApiInfo({}, { export: { formats: ['csv', 'json'], maxRows: 10000 } }).export).toEqual({ formats: ['csv', 'json'], maxRows: 10000 })
  })
})
