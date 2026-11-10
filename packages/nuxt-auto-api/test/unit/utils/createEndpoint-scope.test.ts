import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEndpoint } from '../../../src/runtime/server/utils/createEndpoint'

// `scope` authorizes the endpoint (the person, not only a token), `row` loads what the route names, `refusal` words the
// answer. The real createEndpoint and permission evaluation; only the context plumbing is stubbed.
const h = vi.hoisted(() => ({
  context: {} as any,
  authorize: vi.fn(async () => {}),
  effectiveAuth: undefined as any,
  findAuthorizedRow: vi.fn(async (_c: any, _r: string, id: string): Promise<any> => ({ id })),
}))

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  readBody: vi.fn(async () => ({})),
  getQuery: vi.fn(() => ({})),
  createError: (o: any) => Object.assign(new Error(o.message), { statusCode: o.statusCode, data: o.data }),
}))
vi.mock('../../../src/runtime/server/handlers/createContextFromRegistry', () => ({
  createContextFromRegistry: vi.fn(async () => ({ context: h.context, authorize: h.authorize, validate: vi.fn(async () => {}), runMiddleware: vi.fn(async () => {}), effectiveAuth: h.effectiveAuth })),
  createCallerContext: vi.fn(async () => h.context),
}))
vi.mock('../../../src/runtime/server/database', () => ({
  getDatabaseAdapter: vi.fn(() => ({})),
}))
vi.mock('../../../src/runtime/server/plugins/pluginRegistry', () => ({ getContextExtenders: () => [], getMiddlewareForStage: () => [] }))
vi.mock('../../../src/runtime/server/utils/serializeResponse', () => ({ serializeResponse: (d: any) => d }))
vi.mock('../../../src/runtime/server/utils/rowAccess', () => ({ findAuthorizedRow: h.findAuthorizedRow }))

const run = (opts: any) => createEndpoint({ filterResponse: false, ...opts })({ method: 'POST', path: '/api/orders', context: {} } as any) as Promise<any>
const ok = async () => ({ ok: true })

beforeEach(() => {
  h.authorize.mockClear()
  h.findAuthorizedRow.mockClear()
  h.context = { db: {}, schema: {}, user: { id: 1 }, permissions: [], params: {}, query: {}, validated: {}, event: {}, resource: 'orders', operation: 'create' }
  h.effectiveAuth = { permissions: { read: 'orders:read', create: 'orders:create', publish: () => h.context.user?.id === 2 } }
})

describe('createEndpoint scope: the permission the endpoint is authorized by', () => {
  it('a CRUD word goes by the resource\'s rule for it, not the operation\'s', async () => {
    h.context.permissions = ['orders:read']
    expect(await run({ resource: 'orders', operation: 'create', scope: 'read', handler: ok })).toEqual({ data: { ok: true } })
    expect(h.authorize, 'the operation\'s gate does not run').not.toHaveBeenCalled()
  })

  it('refuses without it, even with the operation\'s permission', async () => {
    h.context.permissions = ['orders:create']
    await expect(run({ resource: 'orders', scope: 'read', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('a CRUD word the resource doesn\'t declare is denied, the held string doesn\'t open it', async () => {
    h.context.permissions = ['orders:delete']
    await expect(run({ resource: 'orders', scope: 'delete', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('another word uses the rule the resource declares for it', async () => {
    await expect(run({ resource: 'orders', scope: 'publish', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
    h.context.user = { id: 2 }
    expect(await run({ resource: 'orders', scope: 'publish', handler: ok })).toEqual({ data: { ok: true } })
  })

  it('an undeclared word asks for <resource>:<word>, and patterns cover it', async () => {
    await expect(run({ resource: 'orders', scope: 'refund', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
    h.context.permissions = ['orders:refund']
    expect(await run({ resource: 'orders', scope: 'refund', handler: ok })).toEqual({ data: { ok: true } })
    h.context.permissions = ['orders:*']
    expect(await run({ resource: 'orders', scope: 'refund', handler: ok })).toEqual({ data: { ok: true } })
  })

  it('a string with a colon is the whole permission, whatever the resource', async () => {
    await expect(run({ resource: 'orders', scope: 'workspace:settings', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
    h.context.permissions = ['workspace:settings']
    expect(await run({ resource: 'orders', scope: 'workspace:settings', handler: ok })).toEqual({ data: { ok: true } })
  })

  it('a signed-out caller gets 401', async () => {
    h.context.user = null
    await expect(run({ resource: 'orders', scope: 'read', handler: ok })).rejects.toMatchObject({ statusCode: 401, message: 'Authentication required' })
  })

  it('sets ctx.endpointScope for the token check and for objectLevel', async () => {
    h.context.permissions = ['orders:read']
    await run({ resource: 'orders', scope: 'read', handler: ok })
    expect(h.context.endpointScope).toBe('read')
  })

  it('a named gate that declares the operation still decides first', async () => {
    h.effectiveAuth.custom = { checkout: { permissions: { create: 'orders:checkout' } } }
    h.context.permissions = ['orders:read']
    await expect(run({ resource: 'orders', endpointName: 'checkout', scope: 'read', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
    h.context.permissions = ['orders:checkout']
    expect(await run({ resource: 'orders', endpointName: 'checkout', scope: 'read', handler: ok })).toEqual({ data: { ok: true } })
  })

  it('skipAuthorization leaves it to the handler', async () => {
    expect(await run({ resource: 'orders', scope: 'read', skipAuthorization: true, handler: ok })).toEqual({ data: { ok: true } })
  })

  it('no scope: the operation\'s gate runs as before', async () => {
    await run({ resource: 'orders', handler: ok })
    expect(h.authorize).toHaveBeenCalledTimes(1)
  })

  it('puts the resource\'s row rules on ctx whichever check ran', async () => {
    const listFilter = () => 'filter'
    const objectLevel = () => true
    h.effectiveAuth = { ...h.effectiveAuth, listFilter, objectLevel }
    h.context.permissions = ['orders:read']
    let seen: any
    await run({ resource: 'orders', scope: 'read', handler: async (ctx: any) => {
      seen = ctx
      return {}
    } })
    expect(seen.listFilter).toBe(listFilter)
    expect(seen.objectLevelCheck).toBe(objectLevel)
  })

  it('standalone: the whole permission is checked', async () => {
    await expect(run({ scope: 'reports:export', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
    h.context.permissions = ['reports:export']
    expect(await run({ scope: 'reports:export', handler: ok })).toEqual({ data: { ok: true } })
  })

  it('standalone: a bare word has nothing to mean, so it fails at startup', () => {
    expect(() => createEndpoint({ scope: 'read', handler: ok })).toThrow(/whole permission/)
  })
})

describe('createEndpoint row: the row the route names', () => {
  beforeEach(() => {
    h.context.permissions = ['orders:create']
    h.context.params = { id: 'o1' }
  })

  it('is loaded through findAuthorizedRow and handed to the handler', async () => {
    let row: any
    await run({ resource: 'orders', row: 'id', handler: async (ctx: any) => {
      row = ctx.row
      return {}
    } })
    expect(h.findAuthorizedRow).toHaveBeenCalledWith(h.context, 'orders', 'o1')
    expect(row).toEqual({ id: 'o1' })
  })

  it('a hidden row\'s 404 stops the handler', async () => {
    h.findAuthorizedRow.mockRejectedValueOnce(Object.assign(new Error('nope'), { statusCode: 404 }))
    const handler = vi.fn(ok)
    await expect(run({ resource: 'orders', row: 'id', handler })).rejects.toMatchObject({ statusCode: 404 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('is loaded after the permission check, so a refused caller learns nothing about the row', async () => {
    h.context.permissions = []
    await expect(run({ resource: 'orders', scope: 'read', row: 'id', handler: ok })).rejects.toMatchObject({ statusCode: 403 })
    expect(h.findAuthorizedRow).not.toHaveBeenCalled()
  })

  it('is there for authorize', async () => {
    const authorize = vi.fn(async (ctx: any) => ctx.row.id === 'o1')
    await run({ resource: 'orders', row: 'id', authorize, handler: ok })
    expect(authorize).toHaveBeenCalled()
  })

  it('a route without the parameter is a 400', async () => {
    h.context.params = {}
    await expect(run({ resource: 'orders', row: 'id', handler: ok })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('needs a resource, at startup', () => {
    expect(() => createEndpoint({ row: 'id', handler: ok })).toThrow(/needs a `resource`/)
  })
})

describe('createEndpoint refusal: what a refused person is told', () => {
  const refusal = 'Only an admin can do this.'

  it('words a refused scope', async () => {
    await expect(run({ resource: 'orders', scope: 'refund', refusal, handler: ok })).rejects.toMatchObject({ statusCode: 403, message: refusal })
  })

  it('words the operation\'s gate too, with no scope', async () => {
    h.authorize.mockRejectedValueOnce(Object.assign(new Error('Forbidden: you don\'t have permission to create orders'), { statusCode: 403 }))
    await expect(run({ resource: 'orders', refusal, handler: ok })).rejects.toMatchObject({ statusCode: 403, message: refusal })
    expect(await run({ resource: 'orders', refusal, handler: ok })).toEqual({ data: { ok: true } })
  })

  it('leaves the gate\'s 401 for an anonymous caller alone', async () => {
    h.authorize.mockRejectedValueOnce(Object.assign(new Error('Authentication required'), { statusCode: 401 }))
    await expect(run({ resource: 'orders', refusal, handler: ok })).rejects.toMatchObject({ statusCode: 401, message: 'Authentication required' })
  })

  it('words a named gate and authorize', async () => {
    h.effectiveAuth.custom = { checkout: { permissions: { create: 'orders:checkout' } } }
    await expect(run({ resource: 'orders', endpointName: 'checkout', refusal, handler: ok })).rejects.toMatchObject({ message: refusal })
    h.context.permissions = ['orders:create']
    await expect(run({ resource: 'orders', authorize: async () => false, refusal, handler: ok })).rejects.toMatchObject({ statusCode: 403, message: refusal })
  })

  it('words a row\'s objectLevel refusal, and leaves its 404 alone', async () => {
    h.context.permissions = ['orders:create']
    h.context.params = { id: 'o1' }
    h.findAuthorizedRow.mockRejectedValueOnce(Object.assign(new Error('Forbidden: …'), { statusCode: 403 }))
    await expect(run({ resource: 'orders', row: 'id', refusal, handler: ok })).rejects.toMatchObject({ statusCode: 403, message: refusal })
    h.findAuthorizedRow.mockRejectedValueOnce(Object.assign(new Error('nope'), { statusCode: 404 }))
    await expect(run({ resource: 'orders', row: 'id', refusal, handler: ok })).rejects.toMatchObject({ statusCode: 404, message: 'Not found' })
  })

  it('a signed-out caller still gets 401 and the plain message', async () => {
    h.context.user = null
    await expect(run({ resource: 'orders', scope: 'refund', refusal, handler: ok })).rejects.toMatchObject({ statusCode: 401, message: 'Authentication required' })
  })

  it('leaves a rule\'s own error alone', async () => {
    h.effectiveAuth.permissions.refund = () => {
      throw Object.assign(new Error('Your plan ended'), { statusCode: 403 })
    }
    await expect(run({ resource: 'orders', scope: 'refund', refusal, handler: ok })).rejects.toMatchObject({ message: 'Your plan ended' })
  })
})
