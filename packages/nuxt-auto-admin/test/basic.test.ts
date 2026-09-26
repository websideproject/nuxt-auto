import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch, fetch } from '@nuxt/test-utils/e2e'
import { buildListFilter } from '../src/runtime/utils/listQuery'
import { parseCsv } from '../src/runtime/utils/csv'
import { apiStatus, bulkItemErrors } from '../src/runtime/utils/apiErrors'
import { changedFields } from '../src/runtime/utils/auditLog'

describe('nuxt-auto-admin module', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  // ─── Module integration ───────────────────────────────────────────────────

  // ─── Admin pages ──────────────────────────────────────────────────────────

  it('serves the admin index page at /admin', async () => {
    const html = await $fetch('/admin')
    expect(html).toBeTruthy()
  })

  it('serves the admin resource list page at /admin/:resource', async () => {
    const html = await $fetch('/admin/posts')
    expect(html).toBeTruthy()
  })

  it('renders admin pages on the client (no server-rendered per-user state to mismatch on hydration)', async () => {
    for (const path of ['/admin', '/admin/posts']) {
      const html = await $fetch<string>(path, { responseType: 'text' })
      // The client-only shell: an empty app root, no rendered page content.
      expect(html).toContain('data-ssr="false"')
      expect(html).toMatch(/<div id="__nuxt"[^>]*><\/div>/)
      expect(html).not.toContain('Manage all')
    }
  })

  // ─── Admin API endpoints ──────────────────────────────────────────────────

  it('does not expose the removed POST /api/admin/m2m/sync', async () => {
    // It wrote arbitrary junction rows without authentication. The admin UI uses the API's authorized M2M routes.
    // (The test that stood here asserted the route EXISTED via `$fetch(…, { ignoreResponseError })`, which returns the
    // error body instead of a status — so it passed whatever the server said.)
    const res = await fetch('/api/admin/m2m/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(res.status).toBe(404)
  })

  // ─── Resource API (via nuxt-auto-api) ─────────────────────────────────────

  it('underlying API registers GET /api/posts list endpoint', async () => {
    const res = await $fetch('/api/posts', { responseType: 'json' })
    expect(res).toMatchObject({ data: expect.any(Array), meta: expect.any(Object) })
  })

  it('underlying API registers GET /api/users list endpoint', async () => {
    const res = await $fetch('/api/users', { responseType: 'json' })
    expect(res).toMatchObject({ data: expect.any(Array) })
  })

  // ─── What the admin features send, against the real API ───────────────────
  // The admin routes render on the client, so these drive the API with exactly the requests the admin builds.

  const createPosts = (titles: string[], extra: Record<string, unknown> = {}) =>
    $fetch<{ data: Array<{ id: number, title: string }> }>('/api/posts/bulk', {
      method: 'POST',
      body: { items: titles.map(title => ({ title, userId: 1, ...extra })) },
    })

  it('search + filters: the $or of $like over text columns, ANDed with column filters', async () => {
    await createPosts(['Search alpha', 'Search beta'], { published: true })
    await createPosts(['Search alpha draft'], { content: 'unpublished', published: false })
    const columns = [{ name: 'title', kind: 'text' as const }, { name: 'published', kind: 'boolean' as const }]
    const list = (filter: unknown) => $fetch<{ data: Array<{ title: string }> }>('/api/posts', { query: { filter: JSON.stringify(filter), sort: 'title' } })

    const searched = await list(buildListFilter({ columns, search: 'alpha', searchFields: ['title'] }))
    expect(searched.data.map(p => p.title)).toEqual(['Search alpha', 'Search alpha draft'])

    const filtered = await list(buildListFilter({ columns, filters: { published: 'true' }, search: 'alpha', searchFields: ['title'] }))
    expect(filtered.data.map(p => p.title)).toEqual(['Search alpha'])

    // A date range on a timestamp column (it used to be a 500)
    const day = (offset: number) => {
      const d = new Date(Date.now() + offset * 86_400_000)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const since = (offset: number) => list(buildListFilter({ columns: [{ name: 'createdAt', kind: 'date' }], filters: { createdAt: { min: day(offset) } } }))
    expect((await since(-1)).data.length).toBeGreaterThanOrEqual(3)
    expect((await since(2)).data).toEqual([])
  })

  it('export: the plugin route returns the filtered list as CSV', async () => {
    await createPosts(['Export me, "quoted"', '=cmd()'])
    const csv = await $fetch<string>('/api/posts/export', {
      query: { format: 'csv', filter: JSON.stringify({ $or: [{ title: { $like: 'Export me' } }, { title: { $like: 'cmd' } }] }), fields: 'id,title' },
      responseType: 'text',
    })
    const [header, ...rows] = parseCsv(csv)
    expect(header).toEqual(['id', 'title'])
    expect(rows.map(r => r[1]).sort()).toEqual(['\'=cmd()', 'Export me, "quoted"'])
  })

  it('bulk delete: a failing item is named, and nothing is deleted (transactional)', async () => {
    const { data: [post] } = await createPosts(['Bulk keep'])
    const err = await $fetch('/api/posts/bulk', { method: 'DELETE', body: { ids: [post!.id, 999999] } }).catch(e => e)
    expect(apiStatus(err)).toBe(400)
    expect(bulkItemErrors(err)).toEqual([expect.objectContaining({ index: 1, id: 999999, error: expect.any(String) })])
    await expect($fetch(`/api/posts/${post!.id}`)).resolves.toMatchObject({ data: { title: 'Bulk keep' } })

    const ok = await $fetch<{ meta: { successful: number } }>('/api/posts/bulk', { method: 'DELETE', body: { ids: [post!.id] } })
    expect(ok.meta.successful).toBe(1)
  })

  it('audit log: history of one record from GET /api/audit-logs', async () => {
    const { data: [post] } = await createPosts(['Audited'])
    await $fetch(`/api/posts/${post!.id}`, { method: 'PATCH', body: { title: 'Audited again' } })
    const feed = await $fetch<{ data: any[] }>('/api/audit-logs', { query: { resource: 'posts', recordId: String(post!.id), limit: 20 } })
    expect(feed.data.map(e => e.operation)).toEqual(['update', 'create'])
    expect(changedFields(feed.data[0])).toEqual(['title'])
  })

  // ─── Runtime config ───────────────────────────────────────────────────────

  it('exposes autoAdmin runtime config with correct prefix', async () => {
    const html = await $fetch('/admin')
    // Runtime config is injected into the page HTML as __NUXT__ payload
    expect(html).toContain('autoAdmin')
  })

  it('tells the admin UI which API routes exist (read from nuxt-auto-api at build time)', async () => {
    const html = await $fetch<string>('/admin', { responseType: 'text' })
    expect(html).toMatch(/api:\{maxLimit:100,bulk:true,maxBatchSize:100,export:\{formats:\["csv","json"\],maxRows:10000,resources:\["posts"\]\},auditLog:true\}/)
  })
})
