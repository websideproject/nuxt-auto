import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { InMemoryCacheStore, createCachePlugin } from '../../../src/runtime/plugins/cachePlugin'

// "Improve plugins" rewrote the cache plugin (store abstraction + lazy expiry) — previously untested.
describe('InMemoryCacheStore', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns undefined for a missing key, the value within TTL', async () => {
    const s = new InMemoryCacheStore({ maxEntries: 100, cleanupMs: 1000 })
    expect(await s.get('k')).toBeUndefined()
    await s.set('k', { v: 1 }, 1000)
    expect(await s.get('k')).toEqual({ v: 1 })
  })

  it('expires lazily after the TTL (and drops the stale entry)', async () => {
    const s = new InMemoryCacheStore({ maxEntries: 100, cleanupMs: 1000 })
    await s.set('k', 'val', 1000)
    vi.advanceTimersByTime(1001)
    expect(await s.get('k'), 'expired → undefined').toBeUndefined()
    expect(await s.get('k')).toBeUndefined()
  })

  it('deleteByPrefix removes only matching keys', async () => {
    const s = new InMemoryCacheStore({ maxEntries: 100, cleanupMs: 1000 })
    await s.set('articles:1', 'a', 10000)
    await s.set('articles:2', 'b', 10000)
    await s.set('users:1', 'c', 10000)
    await s.deleteByPrefix('articles:')
    expect(await s.get('articles:1')).toBeUndefined()
    expect(await s.get('articles:2')).toBeUndefined()
    expect(await s.get('users:1'), 'other prefixes untouched').toBe('c')
  })

  it('evicts the oldest-expiring entries when over maxEntries', async () => {
    const s = new InMemoryCacheStore({ maxEntries: 2, cleanupMs: 100000 })
    await s.set('a', 1, 1000) // expires first
    await s.set('b', 2, 2000)
    await s.set('c', 3, 3000) // now 3 > max 2 → evict oldest-expiring ('a')
    expect(await s.get('a'), 'oldest-expiring evicted').toBeUndefined()
    expect(await s.get('b')).toBe(2)
    expect(await s.get('c')).toBe(3)
  })
})

// Drive the plugin's runtimeSetup with a fake registry ctx that captures the middleware, then run a request the
// way the pipeline does: pre-execute (cache-read) → handler → context.result → post-execute (write, invalidate).
function wirePlugin(opts: any = {}) {
  const middlewares: any[] = []
  const ctx = {
    addMiddleware: (m: any) => { middlewares.push(m) },
    addGlobalHook: () => {},
    logger: { info: vi.fn() },
  }
  createCachePlugin(opts).runtimeSetup!(ctx as any)
  const run = async (stage: string, context: any) => {
    for (const m of middlewares.filter(m => m.stage === stage && (!m.operations || m.operations.includes(context.operation)))) await m.handler(context)
  }
  let handlerCalls = 0
  const request = async (context: any, response: any = { data: [{ id: 1 }], meta: { limit: 20, nextCursor: 'abc' } }) => {
    await run('pre-execute', context)
    if (context.shortCircuit) {
      await run('post-execute', context)
      return context.shortCircuit.data
    }
    handlerCalls++
    context.result = response
    await run('post-execute', context)
    return response
  }
  return { request, calls: () => handlerCalls }
}

const req = (over: any = {}) => ({ resource: 'articles', operation: 'list', query: {}, params: {}, user: { id: 'u1' }, event: { path: '/api/articles', method: 'GET' }, ...over })

describe('createCachePlugin', () => {
  it('is the cache plugin v1.1.0', () => {
    expect(createCachePlugin().name).toBe('cache')
    expect(createCachePlugin().version).toBe('1.1.0')
  })

  it('serves a repeat from cache — the whole response, meta (cursor, total) included', async () => {
    const { request, calls } = wirePlugin({ ttlMs: 10000 })
    const first = await request(req())
    const second = await request(req())
    expect(calls()).toBe(1)
    expect(second).toEqual(first)
    expect(second.meta.nextCursor).toBe('abc')
  })

  it('a write invalidates the resource — create, update (restore) and M2M writes alike', async () => {
    for (const write of [
      { operation: 'create', event: { path: '/api/articles', method: 'POST' } },
      { operation: 'update', event: { path: '/api/articles/1/restore', method: 'POST' } },
      { operation: 'm2m', event: { path: '/api/articles/1/relations/tags', method: 'POST' } },
    ]) {
      const { request, calls } = wirePlugin({ ttlMs: 10000 })
      await request(req())
      await request(req(write), { data: {} })
      await request(req())
      expect(calls(), `${write.operation} invalidated`).toBe(3)
    }
  })

  it('reading M2M links does not invalidate', async () => {
    const { request, calls } = wirePlugin({ ttlMs: 10000 })
    await request(req())
    await request(req({ operation: 'm2m', event: { path: '/api/articles/1/relations/tags', method: 'GET' } }), { ids: [] })
    await request(req())
    expect(calls()).toBe(2)
  })

  it('respects the `resources` allowlist — non-listed resources are never cached', async () => {
    const { request, calls } = wirePlugin({ resources: ['articles'] })
    await request(req({ resource: 'secrets', event: { path: '/api/secrets', method: 'GET' } }))
    await request(req({ resource: 'secrets', event: { path: '/api/secrets', method: 'GET' } }))
    expect(calls()).toBe(2)
  })

  it('different users get different cache keys (no cross-user leak)', async () => {
    const { request, calls } = wirePlugin({ ttlMs: 10000 })
    await request(req())
    await request(req({ user: { id: 'u2' } }))
    expect(calls()).toBe(2)
  })

  it('different routes of one resource do not share an entry (a record vs its /permissions)', async () => {
    const { request, calls } = wirePlugin({ ttlMs: 10000 })
    await request(req({ operation: 'get', event: { path: '/api/articles/permissions', method: 'GET' } }))
    await request(req({ operation: 'get', params: { id: '' }, event: { path: '/api/articles/', method: 'GET' } }))
    expect(calls()).toBe(2)
  })
})
