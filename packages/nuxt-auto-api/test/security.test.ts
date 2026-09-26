import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils/e2e'

/**
 * Security regression suite — through a real Nuxt server and the full request pipeline
 * (route → context extenders → tenant → authorize → validate → handler).
 *
 * Every assertion states the SECURE behaviour. Each block below was a reproduced hole before the
 * deny-by-default / row-visibility rework; see the fixture in ./fixtures/security for the setup:
 *
 *  users   read: 'users:read'           hiddenFields: ['password']      (not tenant-scoped)
 *  posts   read: true, update: 'posts:update'   (create/delete undeclared)   tenant-scoped, soft delete
 *  labels  read: 'labels:read'                                            tenant-scoped
 *  docs    read/update: true, listFilter: published only
 *  notes   no authorization at all
 *
 *  alice → org_a, perms posts:update users:read labels:read · noorg → signed in, no tenant ·
 *  bare → no organizationId on the user · root → org_a with '*'
 */

async function req(path: string, opts: { user?: string, method?: string, body?: any, headers?: Record<string, string> } = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', ...(opts.user ? { 'x-test-user': opts.user } : {}), ...opts.headers },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  let json: any = null
  try {
    json = await res.json()
  }
  catch {
    // not JSON (e.g. the app's HTML shell)
  }
  return { status: res.status, json }
}
const q = (o: any) => encodeURIComponent(JSON.stringify(o))
const titles = (r: any) => (r.json?.data ?? []).map((p: any) => p.title).sort()

describe('security (e2e)', async () => {
  await setup({ rootDir: fileURLToPath(new URL('./fixtures/security', import.meta.url)) })

  describe('SSR (composables)', () => {
    const page = async (user?: string) => (await fetch('/', { headers: user ? { 'x-test-user': user } : {} })).text()

    it('queries the API as the caller during SSR and ships the result to the client', async () => {
      const html = await page('alice')
      // Rendered on the server: the request's headers reached the API (a plain $fetch would be anonymous → 401)
      expect(html).toMatch(/<ul id="labels">[\s\S]*a-green[\s\S]*a-red[\s\S]*<\/ul>/)
      expect(html).not.toContain('b-blue')
      // …and dehydrated into the payload, so the client hydrates instead of refetching
      const payload = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? ''
      expect(payload).toContain('autoapi-vue-query')
      expect(payload).toContain('a-green')
    })

    it('an anonymous SSR render gets the API\'s 401, not someone\'s data', async () => {
      const html = await page()
      expect(html).not.toContain('a-red')
      expect(html).toMatch(/<p id="error">\s*401/)
    })
  })

  describe('deny by default', () => {
    it('a resource with no authorization refuses every operation', async () => {
      expect((await req('/api/notes')).status).toBe(401)
      expect((await req('/api/notes', { method: 'POST', body: { body: 'x' } })).status).toBe(401)
      expect((await req('/api/notes/1', { method: 'DELETE' })).status).toBe(401)
      expect((await req('/api/notes', { user: 'alice' })).status).toBe(403)
    })

    it('an operation the resource does not declare is refused', async () => {
      expect((await req('/api/posts/5', { method: 'DELETE' })).status).toBe(401)
      expect((await req('/api/posts/5', { user: 'alice', method: 'DELETE' })).status).toBe(403)
      expect((await req('/api/posts', { user: 'alice', method: 'POST', body: { title: 'x', userId: 1 } })).status).toBe(403)
    })

    it('`*` is a super-admin: it passes undeclared operations', async () => {
      expect((await req('/api/notes', { user: 'root' })).status).toBe(200)
    })

    it('/api/permissions reports the same answers the gates enforce', async () => {
      const r = await req('/api/permissions', { user: 'alice' })
      expect(r.json.permissions.notes).toMatchObject({ canRead: false, canCreate: false })
      expect(r.json.permissions.posts).toMatchObject({ canRead: true, canUpdate: true, canCreate: false, canDelete: false })
    })
  })

  describe('multi-tenancy — server-side tenant only, fails closed', () => {
    it('a client x-tenant-id header or ?tenantId= is ignored', async () => {
      expect((await req('/api/posts', { user: 'bare', headers: { 'x-tenant-id': 'org_b' } })).status).toBe(403)
      expect((await req('/api/posts?tenantId=org_b', { user: 'bare' })).status).toBe(403)
    })

    it('a signed-in user with no active tenant is refused (not shown every tenant)', async () => {
      expect((await req('/api/posts', { user: 'noorg' })).status).toBe(403)
    })

    it('lists, gets and aggregates only the caller\'s tenant', async () => {
      expect(titles(await req('/api/posts', { user: 'alice' }))).toEqual(['A1', 'A2', 'A3'])
      expect((await req('/api/posts/2', { user: 'alice' })).status).toBe(404)
      expect((await req('/api/posts/aggregate?aggregate=count', { user: 'alice' })).json.data).toEqual([{ count: 3 }])
    })

    it('`?filter[...]` bracket syntax works and stays inside the tenant', async () => {
      expect(titles(await req('/api/posts?filter[title]=A1', { user: 'alice' }))).toEqual(['A1'])
      expect(titles(await req('/api/posts?filter[title]=B1', { user: 'alice' }))).toEqual([])
    })
  })

  describe('read path cannot observe hidden or unreadable columns', () => {
    it('filtering on a hidden field is a 400, not an oracle', async () => {
      expect((await req(`/api/users?filter=${q({ password: { $like: 'hunter' } })}`, { user: 'alice' })).status).toBe(400)
    })
    it('sorting on a hidden field is a 400', async () => {
      expect((await req('/api/users?sort=-password', { user: 'alice' })).status).toBe(400)
    })
    it('aggregating or grouping by a hidden field is a 400', async () => {
      expect((await req('/api/users/aggregate?aggregate=min(password)', { user: 'alice' })).status).toBe(400)
      expect((await req('/api/users/aggregate?aggregate=count&groupBy=password', { user: 'alice' })).status).toBe(400)
      expect((await req('/api/users?aggregate=max(password)', { user: 'alice' })).status).toBe(400)
    })
    it('hidden fields are never in responses', async () => {
      const r = await req('/api/users', { user: 'alice' })
      expect(r.status).toBe(200)
      expect(JSON.stringify(r.json)).not.toContain('hunter2')
    })
    it('unknown fields and operators are 400s, never silently dropped', async () => {
      expect((await req(`/api/posts?filter=${q({ title: { $regex: 'x' } })}`, { user: 'alice' })).status).toBe(400)
      expect((await req(`/api/posts?filter=${q({ _: 1 })}`, { user: 'alice' })).status).toBe(400)
      expect((await req('/api/posts?filter={broken', { user: 'alice' })).status).toBe(400)
    })
  })

  describe('?include= is authorized like the related resource', () => {
    it('including a resource the caller may not read is refused', async () => {
      expect((await req('/api/posts?include=author')).status).toBe(401)
      const r = await req('/api/posts?include=author', { user: 'alice' })
      expect(r.status).toBe(200)
      expect(JSON.stringify(r.json)).not.toContain('hunter2')
    })
  })

  describe('row visibility (listFilter) applies to every access, not only lists', () => {
    it('a row hidden by listFilter is a 404 on GET, PATCH and as a list result', async () => {
      expect(titles(await req('/api/docs'))).toEqual(['public doc'])
      expect((await req('/api/docs/2')).status).toBe(404)
      expect((await req('/api/docs/2', { method: 'PATCH', body: { title: 'pwned' } })).status).toBe(404)
    })
  })

  describe('writes cannot touch server-owned columns', () => {
    it('PATCH cannot move a row into another tenant', async () => {
      expect((await req('/api/posts/1', { user: 'alice', method: 'PATCH', body: { organizationId: 'org_b', title: 'A1' } })).status).toBe(200)
      const after = await req('/api/posts/1', { user: 'alice' })
      expect(after.json.data.organizationId).toBe('org_a')
    })

    it('PATCH cannot rewrite the primary key or un-delete through deletedAt', async () => {
      await req('/api/posts/4', { user: 'alice', method: 'PATCH', body: { id: 500 } })
      expect((await req('/api/posts/4', { user: 'alice' })).status).toBe(200)
      await req('/api/posts/4', { user: 'alice', method: 'PATCH', body: { deletedAt: new Date().toISOString() } })
      expect((await req('/api/posts/4', { user: 'alice' })).status).toBe(200)
    })
  })

  describe('restore', () => {
    it('cannot reach another tenant\'s trashed row', async () => {
      expect((await req('/api/posts/3/restore', { user: 'alice', method: 'POST' })).status).toBe(404)
    })
    it('restores the caller\'s own trashed row (restore falls back to update)', async () => {
      expect((await req('/api/posts/6/restore', { user: 'alice', method: 'POST' })).status).toBe(200)
    })
    it('is refused before any lookup for a caller without the permission', async () => {
      expect((await req('/api/posts/999/restore', { method: 'POST' })).status).toBe(401)
    })
  })

  describe('bulk', () => {
    it('is gated and validated per item', async () => {
      expect((await req('/api/notes/bulk', { method: 'POST', body: { items: [{ body: 'x' }] } })).status).toBe(401)
      const r = await req('/api/posts/bulk', { user: 'alice', method: 'PATCH', body: { items: [{ id: 5, data: { title: 'A3!', organizationId: 'org_b' } }] } })
      expect(r.status).toBe(200)
      expect(r.json.data[0]).toMatchObject({ title: 'A3!', organizationId: 'org_a' })
      const bad = await req('/api/posts/bulk', { user: 'alice', method: 'PATCH', body: { items: [{ title: 'no id' }] } })
      expect(bad.status).toBe(400)
    })
    it('cannot update another tenant\'s rows', async () => {
      const r = await req('/api/posts/bulk', { user: 'alice', method: 'PATCH', body: { items: [{ id: 2, data: { title: 'pwned' } }] } })
      expect(r.status).toBe(400)
      expect((await req('/api/posts/2', { user: 'root' })).status).toBe(404) // root is in org_a
    })
  })

  describe('many-to-many', () => {
    it('cannot link another tenant\'s rows', async () => {
      const r = await req('/api/posts/1/relations/labels/add', { user: 'alice', method: 'POST', body: { ids: [2] } })
      expect(r.status).toBe(404)
    })
    it('links visible rows', async () => {
      expect((await req('/api/posts/1/relations/labels/add', { user: 'alice', method: 'POST', body: { ids: [3] } })).status).toBe(200)
    })
    it('a filter never widens the list beyond the linked rows', async () => {
      const r = await req(`/api/posts/1/relations/labels?includeRecords=true&filter=${q({})}`, { user: 'alice' })
      expect(r.status).toBe(200)
      expect(r.json.records.map((l: any) => l.name).sort()).toEqual(['a-green', 'a-red'])
    })
    it('requires read permission on the related resource', async () => {
      expect((await req('/api/posts/1/relations/labels', { user: 'noorg' })).status).toBe(403)
    })
  })

  describe('module wiring', () => {
    it('the public server utils are auto-imported in app server code', async () => {
      const r = await req('/api/_autoimports')
      expect(r.json).toEqual({ createEndpoint: 'function', findAuthorizedRow: 'function', evaluatePermission: 'function' })
    })
  })

  describe('discovery endpoints', () => {
    it('the debug endpoint no longer exists; junction discovery needs a signed-in caller', async () => {
      // No route: the fixture app (no pages/) answers unknown URLs with its HTML shell — no API JSON.
      expect((await req('/api/_m2m/debug-detection')).json).toBeNull()
      expect((await req('/api/_m2m/junctions')).status).toBe(401)
      expect((await req('/api/_m2m/detect/users')).status).toBe(401)
      expect((await req('/api/_m2m/detect/users', { user: 'alice' })).status).toBe(200)
    })
  })

  describe('routes added by plugins', () => {
    it('export is the list, authorized: anonymous is refused, hidden fields and other tenants stay out', async () => {
      expect((await req('/api/users/export')).status).toBe(401)
      expect((await req('/api/notes/export', { user: 'alice' })).status).toBe(403)

      const users = await req('/api/users/export', { user: 'alice' })
      expect(users.status).toBe(200)
      expect(users.json.data.length).toBeGreaterThan(0)
      expect(users.json.data.every((u: any) => !('password' in u))).toBe(true)

      const posts = await req('/api/posts/export', { user: 'alice' })
      expect(posts.json.data.every((p: any) => p.organizationId === 'org_a')).toBe(true)

      const csv = await (await fetch('/api/users/export?format=csv', { headers: { 'x-test-user': 'alice' } })).text()
      expect(csv.split('\r\n')[0]).not.toContain('password')
      expect(csv).not.toContain('hunter2')
    })

    it('upload is an authorized update of a visible row', async () => {
      const form = () => {
        const f = new FormData()
        f.append('file', new Blob(['png'], { type: 'image/png' }), 'cover.png')
        return f
      }
      const upload = (id: number, user?: string) => fetch(`/api/posts/${id}/upload`, { method: 'POST', body: form(), headers: user ? { 'x-test-user': user } : {} })

      expect((await upload(1)).status).toBe(401)
      expect((await upload(2, 'alice')).status).toBe(404) // org_b's post
      const ok = await upload(1, 'alice')
      expect(ok.status).toBe(200)
      expect((await ok.json()).data.cover).toMatch(/^\/uploads\/posts\/[\w-]+\.png$/)
    })

    it('deleting an upload never removes a file outside the upload directory', async () => {
      const { mkdirSync, writeFileSync, existsSync } = await import('node:fs')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const root = join(tmpdir(), 'autoapi-security-uploads')
      mkdirSync(root, { recursive: true })
      const outside = join(root, '..', 'autoapi-security-sentinel.txt')
      writeFileSync(outside, 'keep')

      // The file column is an ordinary writable column, so it can point anywhere.
      await req('/api/posts/1', { user: 'alice', method: 'PATCH', body: { cover: '/uploads/posts/../../autoapi-security-sentinel.txt' } })
      const res = await fetch('/api/posts/1/upload', { method: 'DELETE', headers: { 'x-test-user': 'alice' } })
      expect(res.status).toBe(200)
      expect(existsSync(outside)).toBe(true)
    })
  })

  it('a rate limiter listed inline in nuxt.config limits (its options reach the server)', async () => {
    const hit = () => req('/api/docs', { headers: { 'x-rate-test': '1' } })
    expect((await hit()).status).toBe(200)
    expect((await hit()).status).toBe(200)
    expect((await hit()).status).toBe(429)
    expect((await req('/api/docs')).status).toBe(200)
  })
})
