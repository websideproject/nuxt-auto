import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch, useTestContext } from '@nuxt/test-utils/e2e'

// `autoApi.vueQuery: false` — the REST API without the client layer, for apps that do not install @tanstack/vue-query.
describe('vueQuery: false (e2e)', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    nuxtConfig: { autoApi: { vueQuery: false } } as any,
  })

  it('still serves the REST API', async () => {
    const res = await $fetch('/api/posts', { responseType: 'json' })
    expect(res).toMatchObject({ data: expect.any(Array), meta: expect.any(Object) })
  })

  it('renders without a QueryClient in the payload', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('basic')
    expect(html).not.toContain('autoapi-vue-query')
  })

  it('ships no vue-query in the client bundle', () => {
    // @nuxt/test-utils builds into `<buildDir>/output`.
    const publicDir = join(useTestContext().nuxt!.options.buildDir, 'output/public/_nuxt')
    const chunks = readdirSync(publicDir).filter(f => f.endsWith('.js'))
    expect(chunks.length).toBeGreaterThan(0)
    // vue-query's injection key — a string literal, so it survives minification.
    for (const chunk of chunks) expect(readFileSync(join(publicDir, chunk), 'utf8'), chunk).not.toContain('VUE_QUERY_CLIENT')
  })
})
