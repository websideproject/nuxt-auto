import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// The mutation's fetch is all that matters here: capture the TanStack options and call `mutationFn`.
const h = vi.hoisted(() => ({ fetcher: vi.fn(async (_url: string, _init?: any) => ({ ok: true })), options: null as any }))
vi.mock('@tanstack/vue-query', () => ({
  useMutation: (opts: any) => {
    h.options = opts
    return opts
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('../../../src/runtime/composables/autoApiFetch', () => ({ useAutoApiFetch: () => h.fetcher }))
vi.mock('../../../src/runtime/composables/useAutoApiToast', () => ({ useAutoApiToast: () => ({ handleSuccess: vi.fn(), handleError: vi.fn() }) }))

const { useAutoApiEndpointMutation } = await import('../../../src/runtime/composables/useAutoApiEndpoint')

describe('useAutoApiEndpointMutation', () => {
  beforeEach(() => {
    h.fetcher.mockClear()
  })

  it('posts the input to a fixed URL', async () => {
    useAutoApiEndpointMutation('/api/things/import')
    await h.options.mutationFn({ rows: [1] })
    expect(h.fetcher).toHaveBeenCalledWith('/api/things/import', { method: 'POST', body: { rows: [1] } })
  })

  it('reads a ref URL at call time', async () => {
    const url = ref('/api/a')
    useAutoApiEndpointMutation(url, { method: 'DELETE' })
    url.value = '/api/b'
    await h.options.mutationFn({})
    expect(h.fetcher).toHaveBeenCalledWith('/api/b', { method: 'DELETE', body: {} })
  })

  it('builds a per-row URL from the input', async () => {
    useAutoApiEndpointMutation((v: { id: string }) => `/api/campaigns/${v.id}/send`)
    await h.options.mutationFn({ id: 'c1' })
    await h.options.mutationFn({ id: 'c2' })
    expect(h.fetcher.mock.calls.map(c => c[0])).toEqual(['/api/campaigns/c1/send', '/api/campaigns/c2/send'])
  })
})
