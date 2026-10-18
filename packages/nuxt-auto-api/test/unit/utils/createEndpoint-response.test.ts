import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEndpoint } from '../../../src/runtime/server/utils/createEndpoint'

// A real context per request (the filters read hidden fields from the registry and field rules from effectiveAuth).
const { state } = vi.hoisted(() => ({ state: { middleware: [] as any[], context: undefined as any } }))

vi.mock('h3', async (importOriginal) => {
  const h3 = await importOriginal<typeof import('h3')>()
  return { ...h3, defineEventHandler: (handler: any) => handler, getQuery: () => ({}) }
})

vi.mock('../../../src/runtime/server/handlers/createContextFromRegistry', () => {
  const build = (event: any, operation: any, resource: string) => {
    const authorization = {
      permissions: { read: true },
      fields: { salary: { read: (ctx: any) => ctx.user?.role === 'admin' } },
    }
    state.context = {
      db: {},
      schema: {},
      user: event.context.user,
      permissions: [],
      params: { ...(event.context.params?.id ? { id: event.context.params.id } : {}) },
      query: {},
      validated: {},
      event,
      resource,
      operation,
      runtimeConfig: { autoApi: {} },
      resourceConfig: { name: resource, hiddenFields: ['passwordHash'], authorization },
      effectiveAuth: authorization,
      registry: { [resource]: { name: resource, hiddenFields: ['passwordHash'] } },
    }
    return state.context
  }
  return {
    createContextFromRegistry: vi.fn(async (event: any, operation: any) => ({
      context: build(event, operation, 'users'),
      authorize: vi.fn(),
      validate: vi.fn(),
      effectiveAuth: state.context.effectiveAuth,
      runMiddleware: async (stage: string) => {
        for (const mw of state.middleware.filter(m => m.stage === stage)) await mw.handler(state.context)
      },
    })),
    createCallerContext: vi.fn(async (event: any, operation: any) => ({ ...build(event, operation, ''), registry: { users: { hiddenFields: ['passwordHash'] } } })),
  }
})

vi.mock('../../../src/runtime/server/database', () => ({ getDatabaseAdapter: vi.fn(() => ({})) }))
vi.mock('../../../src/runtime/server/plugins/pluginRegistry', () => ({
  getContextExtenders: () => [],
  getMiddlewareForStage: (stage: string) => state.middleware.filter(m => m.stage === stage),
}))

const user = { id: 1, name: 'Ada', passwordHash: 'x', salary: 100, profile: { passwordHash: 'y', bio: 'hi' } }
const event = (opts: { role?: string, params?: Record<string, string> } = {}) =>
  ({ method: 'GET', context: { user: { id: 9, role: opts.role ?? 'user' }, params: { ...opts.params } } }) as any

beforeEach(() => {
  state.middleware = []
})

describe('createEndpoint response filtering', () => {
  it('removes hidden fields everywhere and unreadable fields from the row of a resource-bound endpoint', async () => {
    const handler = createEndpoint({ resource: 'users', handler: () => structuredClone(user) })
    expect(await (handler as any)(event())).toEqual({ data: { id: 1, name: 'Ada', profile: { bio: 'hi' } } })
  })

  it('filters every row of an array', async () => {
    const handler = createEndpoint({ resource: 'users', handler: () => [structuredClone(user), structuredClone(user)] })
    const { data } = await (handler as any)(event())
    expect(data.map((r: any) => Object.keys(r))).toEqual([['id', 'name', 'profile'], ['id', 'name', 'profile']])
  })

  it('keeps fields the caller may read', async () => {
    const handler = createEndpoint({ resource: 'users', handler: () => structuredClone(user) })
    expect((await (handler as any)(event({ role: 'admin' }))).data.salary).toBe(100)
  })

  it('returns the payload untouched with filterResponse: false', async () => {
    const handler = createEndpoint({ resource: 'users', filterResponse: false, handler: () => structuredClone(user) })
    expect((await (handler as any)(event())).data).toEqual(user)
  })

  it('does not filter a standalone endpoint unless asked', async () => {
    expect((await (createEndpoint({ handler: () => structuredClone(user) }) as any)(event())).data).toEqual(user)
    const filtered = createEndpoint({ filterResponse: true, handler: () => structuredClone(user) })
    expect((await (filtered as any)(event())).data.passwordHash).toBeUndefined()
  })

  it('passes a non-JSON result through', async () => {
    const response = new Response('csv')
    const handler = createEndpoint({ resource: 'users', responseFormat: 'raw', handler: () => response })
    expect(await (handler as any)(event())).toBe(response)
  })
})

describe('createEndpoint route params', () => {
  it('exposes every route param on a resource-bound endpoint', async () => {
    let seen: any
    const handler = createEndpoint({
      resource: 'users',
      handler: (ctx) => {
        seen = ctx.params
        return {}
      },
    })
    await (handler as any)(event({ params: { slug: 'ada', id: '1' } }))
    expect(seen).toEqual({ slug: 'ada', id: '1' })
  })
})

describe('createEndpoint middleware', () => {
  it('serves a short-circuit from pre-execute without running the handler', async () => {
    const cacheHit = (ctx: any) => {
      ctx.shortCircuit = { data: { cached: true } }
    }
    state.middleware = [{ stage: 'pre-execute', handler: cacheHit }]
    const run = vi.fn()
    const handler = createEndpoint({ resource: 'users', handler: run })
    expect(await (handler as any)(event())).toEqual({ data: { cached: true } })
    expect(run).not.toHaveBeenCalled()
  })

  it('gives post-execute the (filtered) result', async () => {
    let result: any
    const capture = (ctx: any) => {
      result = ctx.result
    }
    state.middleware = [{ stage: 'post-execute', handler: capture }]
    await (createEndpoint({ resource: 'users', handler: () => structuredClone(user) }) as any)(event())
    expect(result).toEqual({ id: 1, name: 'Ada', profile: { bio: 'hi' } })
  })
})
