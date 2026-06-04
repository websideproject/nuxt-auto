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

// Drive the plugin's runtimeSetup with a fake registry ctx that captures the middleware + hooks, then
// exercise the cache read/write/invalidate cycle against a shared store.
function wirePlugin(opts: any = {}) {
  const middlewares: Record<string, any> = {}
  const hooks: any[] = []
  const ctx = {
    addMiddleware: (m: any) => { middlewares[m.name] = m },
    addGlobalHook: (h: any) => { hooks.push(h) },
    logger: { info: vi.fn() },
  }
  const plugin = createCachePlugin(opts)
  ;(plugin as any).runtimeSetup(ctx)
  const callHook = async (name: string, ...args: any[]) => { for (const h of hooks) if (h[name]) await h[name](...args) }
  return { plugin, middlewares, callHook }
}

describe('createCachePlugin', () => {
  it('is the cache plugin v1.1.0', () => {
    expect(createCachePlugin().name).toBe('cache')
    expect(createCachePlugin().version).toBe('1.1.0')
  })

  it('full cycle: a miss serves nothing, the after-hook caches, a repeat is served from cache', async () => {
    const { middlewares, callHook } = wirePlugin({ ttlMs: 10000 })
    const ctx: any = { resource: 'articles', operation: 'get', query: {}, params: { id: '1' }, user: { id: 'u1' } }

    await middlewares['cache-read'].handler(ctx)
    expect(ctx.shortCircuit, 'first call is a miss').toBeUndefined()

    await callHook('afterGet', { id: 1, title: 'X' }, ctx) // caches the result

    const ctx2: any = { resource: 'articles', operation: 'get', query: {}, params: { id: '1' }, user: { id: 'u1' } }
    await middlewares['cache-read'].handler(ctx2)
    expect(ctx2.shortCircuit, 'second identical call is served from cache').toEqual({ data: { data: { id: 1, title: 'X' } } })
  })

  it('a mutation invalidates the resource’s cached entries', async () => {
    const { middlewares, callHook } = wirePlugin({ ttlMs: 10000 })
    const get: any = { resource: 'articles', operation: 'get', query: {}, params: { id: '1' }, user: { id: 'u1' } }
    await middlewares['cache-read'].handler(get)
    await callHook('afterGet', { id: 1 }, get) // cached

    await callHook('afterCreate', { id: 2 }, { resource: 'articles' }) // invalidates "articles:"

    const get2: any = { resource: 'articles', operation: 'get', query: {}, params: { id: '1' }, user: { id: 'u1' } }
    await middlewares['cache-read'].handler(get2)
    expect(get2.shortCircuit, 'cache was invalidated by the create').toBeUndefined()
  })

  it('respects the `resources` allowlist — non-listed resources are never cached', async () => {
    const { middlewares, callHook } = wirePlugin({ resources: ['articles'] })
    const ctx: any = { resource: 'secrets', operation: 'get', query: {}, params: { id: '1' } }
    await callHook('afterGet', { id: 1 }, ctx) // should NOT cache (not allowlisted)
    await middlewares['cache-read'].handler(ctx)
    expect(ctx.shortCircuit, 'non-allowlisted resource is not served from cache').toBeUndefined()
  })

  it('different users get different cache keys (no cross-user leak)', async () => {
    const { middlewares, callHook } = wirePlugin({ ttlMs: 10000 })
    const u1: any = { resource: 'articles', operation: 'list', query: {}, user: { id: 'u1' } }
    await middlewares['cache-read'].handler(u1)
    await callHook('afterList', [{ id: 1 }], u1)

    const u2: any = { resource: 'articles', operation: 'list', query: {}, user: { id: 'u2' } }
    await middlewares['cache-read'].handler(u2)
    expect(u2.shortCircuit, 'u2 must not see u1’s cached list').toBeUndefined()
  })
})
