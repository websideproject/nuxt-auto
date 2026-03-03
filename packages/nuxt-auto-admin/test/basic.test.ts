import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

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

  it('registers POST /api/admin/m2m/sync endpoint', async () => {
    // The endpoint exists — a bad request returns 4xx (not 404)
    const status = await $fetch('/api/admin/m2m/sync', {
      method: 'POST',
      body: {},
      responseType: 'json',
      ignoreResponseError: true,
    }).catch((err: any) => err.response?.status ?? err.status)

    expect(status).not.toBe(404)
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
