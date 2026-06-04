import { describe, it, expect, beforeEach, vi } from 'vitest'

// NEW behaviour ("Improve custom endpoint"): a NAMED custom gate (`endpointName`) whose permissions
// fully REPLACE the base collection-level authorize — so an endpoint can open an operation that the
// resource locks (e.g. `create: () => false` resource that still exposes a `/checkout` action). Plus
// `options.authorize` for object-level checks. We drive the real createEndpoint with the real
// `hasPermission`, stubbing only the context/registry plumbing.
const h = vi.hoisted(() => ({
  context: { db: {}, schema: {}, user: { id: 1 } as any, permissions: ['user'], params: {}, query: {}, validated: {}, event: {} as any, resource: 'orders', operation: 'create' as string },
  authorize: vi.fn(async () => {}),
  validate: vi.fn(async () => {}),
  runMiddleware: vi.fn(async () => {}),
  effectiveAuth: undefined as any,
}))

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  readBody: vi.fn(async () => ({})),
  getQuery: vi.fn(() => ({})),
  createError: (o: any) => Object.assign(new Error(o.message), { statusCode: o.statusCode, data: o.data }),
}))
vi.mock('../../../src/runtime/server/handlers/createContextFromRegistry', () => ({
  createContextFromRegistry: vi.fn(async () => ({ context: h.context, authorize: h.authorize, validate: h.validate, runMiddleware: h.runMiddleware, effectiveAuth: h.effectiveAuth })),
}))
vi.mock('../../../src/runtime/server/database', () => ({
  getDatabaseAdapter: vi.fn(() => ({ engine: 'better-sqlite3', db: {}, atomic: vi.fn(), getMutationCount: vi.fn(), supportsReturning: true, supportsNativeBatch: false })),
}))
vi.mock('../../../src/runtime/server/plugins/pluginRegistry', () => ({ getContextExtenders: () => [], getMiddlewareForStage: () => [] }))
vi.mock('../../../src/runtime/server/utils/serializeResponse', () => ({ serializeResponse: (d: any) => d }))

import { createEndpoint } from '../../../src/runtime/server/utils/createEndpoint'

const run = (opts: any) => createEndpoint(opts)({ method: 'POST', path: '/api/orders', context: {} } as any)

describe('createEndpoint — named custom gate (NEW)', () => {
  beforeEach(() => {
    h.authorize.mockClear()
    h.context.user = { id: 1 }
    h.context.permissions = ['user']
    h.context.operation = 'create'
    h.effectiveAuth = { custom: { checkout: { permissions: { create: 'admin' } } } }
  })

  it('a custom gate REPLACES the base authorize and denies without the required perm (403)', async () => {
    await expect(run({ resource: 'orders', operation: 'create', endpointName: 'checkout', handler: async () => ({}) }))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(h.authorize, 'base collection gate is bypassed when a custom gate exists').not.toHaveBeenCalled()
  })

  it('a custom gate ALLOWS the operation when the perm is present (still bypassing the base gate)', async () => {
    h.context.permissions = ['user', 'admin']
    const res = await run({ resource: 'orders', operation: 'create', endpointName: 'checkout', handler: async () => ({ ok: true }) })
    expect(res).toEqual({ data: { ok: true } })
    expect(h.authorize).not.toHaveBeenCalled()
  })

  it('an unauthenticated caller hitting a denying custom gate gets 401 (not 403)', async () => {
    h.context.user = null
    await expect(run({ resource: 'orders', operation: 'create', endpointName: 'checkout', handler: async () => ({}) }))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('maps read-like operations (list/get) to the gate’s `read` permission', async () => {
    h.context.operation = 'list'
    h.effectiveAuth = { custom: { checkout: { permissions: { read: 'admin' } } } }
    await expect(run({ resource: 'orders', operation: 'list', endpointName: 'checkout', handler: async () => ({}) }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('with NO endpointName the base collection authorize runs as before', async () => {
    await run({ resource: 'orders', operation: 'create', handler: async () => ({}) })
    expect(h.authorize, 'falls back to the base gate').toHaveBeenCalledWith(h.context)
  })

  it('`options.authorize` returning false is a 403 (object-level check)', async () => {
    await expect(run({ resource: 'orders', operation: 'create', skipAuthorization: true, authorize: async () => false, handler: async () => ({}) }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('`options.authorize` returning true proceeds', async () => {
    const res = await run({ resource: 'orders', operation: 'create', skipAuthorization: true, authorize: async () => true, handler: async () => ({ ok: 1 }) })
    expect(res).toEqual({ data: { ok: 1 } })
  })
})
