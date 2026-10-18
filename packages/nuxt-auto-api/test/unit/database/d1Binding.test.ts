import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { initializeDatabaseFromBinding } from '../../../src/runtime/server/database/d1Binding'
import { getDatabaseAdapter } from '../../../src/runtime/server/database'

function boot(plugin: any) {
  let onRequest: any
  const hook = (name: string, fn: any) => {
    if (name === 'request') onRequest = fn
  }
  plugin({ hooks: { hook } })
  return (env: Record<string, unknown> | undefined) => onRequest({ context: { cloudflare: env ? { env } : undefined } })
}

const fakeD1 = () => ({ prepare: () => ({}), batch: async () => [] })

beforeEach(() => {
  globalThis.__autoApiDbAdapter = undefined
})

describe('initializeDatabaseFromBinding', () => {
  it('initializes a D1 database from the binding on the first request', () => {
    const request = boot(initializeDatabaseFromBinding('DB', { schema: {} }))
    const d1 = fakeD1()
    request({ DB: d1 })
    const adapter = getDatabaseAdapter()
    expect(adapter.engine).toBe('d1')
    expect((adapter.db as any).$client).toBe(d1)

    // The same binding: kept
    request({ DB: d1 })
    expect(getDatabaseAdapter()).toBe(adapter)
    // A new binding object: re-initialized
    request({ DB: fakeD1() })
    expect(getDatabaseAdapter()).not.toBe(adapter)
  })

  it('reads the named binding', () => {
    const request = boot(initializeDatabaseFromBinding('MAIN_DB'))
    const d1 = fakeD1()
    request({ MAIN_DB: d1 })
    expect((getDatabaseAdapter().db as any).$client).toBe(d1)
  })

  it('answers 500 naming a missing binding', () => {
    const request = boot(initializeDatabaseFromBinding('DB'))
    expect(() => request(undefined)).toThrow(/D1 binding "DB" not found/)
  })

  it('queries a real D1 binding (Miniflare)', async () => {
    const { Miniflare } = await import('miniflare')
    const mf = new Miniflare({ modules: true, script: 'export default { fetch: () => new Response(null) }', d1Databases: { DB: 'binding-test' } })
    try {
      const request = boot(initializeDatabaseFromBinding('DB'))
      request({ DB: await mf.getD1Database('DB') })
      const rows = await getDatabaseAdapter().db.all(sql`select 1 + 1 as two`)
      expect(rows).toEqual([{ two: 2 }])
    }
    finally {
      await mf.dispose()
    }
  }, 30_000)
})
