import { describe, it, expect, vi, afterEach } from 'vitest'
import { createWebhookPlugin } from '../../../src/runtime/plugins/webhookPlugin'

describe('webhook plugin', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('never sends the resource\'s hidden fields to the endpoint', async () => {
    const sent: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      sent.push(JSON.parse(init.body))
      return new Response(null, { status: 200 })
    }))
    const hooks: any = {}
    createWebhookPlugin({ endpoints: [{ url: 'https://hooks.example/x', events: ['*'] }] })
      .runtimeSetup!({ addGlobalHook: (h: any) => Object.assign(hooks, h), logger: { info() {} } } as any)

    const context = {
      resource: 'users',
      user: { id: 1, email: 'a@x.test' },
      runtimeConfig: { autoApi: { hiddenFields: { resources: { users: ['password'] } } } },
      resourceConfig: { hiddenFields: ['apiKey'] },
    }
    hooks.afterCreate({ id: 7, email: 'new@x.test', password: 'hash', apiKey: 'k' }, context)
    await vi.waitFor(() => expect(sent).toHaveLength(1))

    expect(sent[0]).toMatchObject({ event: 'users.create', data: { id: 7, email: 'new@x.test' } })
    expect(sent[0].data).not.toHaveProperty('password')
    expect(sent[0].data).not.toHaveProperty('apiKey')
  })
})
