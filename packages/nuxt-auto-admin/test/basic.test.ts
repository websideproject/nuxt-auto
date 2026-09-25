import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch, fetch } from '@nuxt/test-utils/e2e'

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

  // ─── Runtime config ───────────────────────────────────────────────────────

  it('exposes autoAdmin runtime config with correct prefix', async () => {
    const html = await $fetch('/admin')
    // Runtime config is injected into the page HTML as __NUXT__ payload
    expect(html).toContain('autoAdmin')
  })
})
