import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('nuxt-auto-api module', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  // ─── Module integration ───────────────────────────────────────────────────

  it('mounts and serves the app', async () => {
    const html = await $fetch('/')
    expect(html).toBeTruthy()
  })

  // ─── API endpoint registration ────────────────────────────────────────────

  it('registers GET /api/posts list endpoint', async () => {
    const res = await $fetch('/api/posts', { responseType: 'json' })
    expect(res).toMatchObject({ data: expect.any(Array), meta: expect.any(Object) })
  })

  it('registers GET /api/users list endpoint', async () => {
    const res = await $fetch('/api/users', { responseType: 'json' })
    expect(res).toMatchObject({ data: expect.any(Array) })
  })

  // ─── CRUD operations ──────────────────────────────────────────────────────

  it('creates a post via POST /api/posts', async () => {
    const res: any = await $fetch('/api/posts', {
      method: 'POST',
      body: { title: 'Hello World', content: 'Test content', userId: 1 },
      responseType: 'json',
    })
    const post = res.data
    expect(post.id).toBeDefined()
    expect(post.title).toBe('Hello World')
  })

  it('reads a post via GET /api/posts/:id', async () => {
    // Create first
    const createdRes: any = await $fetch('/api/posts', {
      method: 'POST',
      body: { title: 'Read me', userId: 1 },
      responseType: 'json',
    })
    const created = createdRes.data

    const res: any = await $fetch(`/api/posts/${created.id}`, { responseType: 'json' })
    const post = res.data
    expect(post.id).toBe(created.id)
    expect(post.title).toBe('Read me')
  })

  it('updates a post via PATCH /api/posts/:id', async () => {
    const createdRes: any = await $fetch('/api/posts', {
      method: 'POST',
      body: { title: 'Original', userId: 1 },
      responseType: 'json',
    })
    const created = createdRes.data

    const res: any = await $fetch(`/api/posts/${created.id}`, {
      method: 'PATCH',
      body: { title: 'Updated' },
      responseType: 'json',
    })
    const updated = res.data
    expect(updated.title).toBe('Updated')
  })

  it('deletes a post via DELETE /api/posts/:id', async () => {
    const createdRes: any = await $fetch('/api/posts', {
      method: 'POST',
      body: { title: 'Delete me', userId: 1 },
      responseType: 'json',
    })
    const created = createdRes.data

    await $fetch(`/api/posts/${created.id}`, { method: 'DELETE' })

    // Should not appear in the default list (soft delete)
    const list: any = await $fetch('/api/posts', { responseType: 'json' })
    const found = list.data.find((p: any) => p.id === created.id)
    expect(found).toBeUndefined()
  })

  // ─── Pagination and filtering ─────────────────────────────────────────────

  it('supports limit/offset pagination', async () => {
    const res: any = await $fetch('/api/posts?limit=5&page=1', { responseType: 'json' })
    expect(res.meta.limit).toBe(5)
    expect(res.data.length).toBeLessThanOrEqual(5)
  })

  it('supports field filtering via filter param', async () => {
    await $fetch('/api/posts', {
      method: 'POST',
      body: { title: 'Published post', published: true, userId: 1 },
      responseType: 'json',
    })

    const res: any = await $fetch('/api/posts?filter={"published":true}', { responseType: 'json' })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((p: any) => p.published === true)).toBe(true)
  })

  // ─── Permissions endpoint ─────────────────────────────────────────────────

  it('serves GET /api/posts/permissions', async () => {
    const res: any = await $fetch('/api/posts/permissions', { responseType: 'json' })
    expect(res).toMatchObject({
      canRead: expect.any(Boolean),
      canCreate: expect.any(Boolean),
    })
  })
})
