import { beforeEach, describe, it, expect, vi } from 'vitest'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createApiTokenPlugin } from '../../../src/runtime/plugins/apiTokenPlugin'
import { protectedFieldsFor } from '../../../src/runtime/server/utils/protectedFields'
import { schemasFor } from '../../../src/runtime/server/validation/schemaGenerator'

// The rotate-flag middleware reads the raw body; here the test's event carries it.
vi.mock('h3', async importOriginal => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: async (event: any) => event.__body,
}))

async function hooksFor(options: Parameters<typeof createApiTokenPlugin>[0]) {
  const hooks: Record<string, any> = {}
  const ctx = {
    addHook: (resource: string, h: any) => { hooks[resource] = h },
    addMiddleware: () => {},
    addServerHandler: () => {},
    extendContext: () => {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  }
  await createApiTokenPlugin(options).runtimeSetup!(ctx as any)
  return hooks
}

const caller = { user: { id: 'alice' }, tenant: { id: 'org-a', field: 'organizationId', canAccessAllTenants: false } } as any

describe('api token ownership', () => {
  it('a new token always belongs to the caller and their organization', async () => {
    const { apiKeys } = await hooksFor({ resources: { apiKeys: { orgField: 'organizationId' } } })
    const data = await apiKeys.beforeCreate({ name: 'ci', userId: 'admin', organizationId: 'org-b', key: 'mine' }, caller)
    expect(data).toMatchObject({ name: 'ci', userId: 'alice', organizationId: 'org-a' })
    expect(data.key).not.toBe('mine')
  })

  it('a token cannot be created without a signed-in caller', async () => {
    const { apiKeys } = await hooksFor({ resources: { apiKeys: {} } })
    expect(() => apiKeys.beforeCreate({ name: 'ci', userId: 'admin' }, { user: null } as any)).toThrow(/Authentication required/)
  })

  it('an update cannot move a token to another owner or organization, or set its secret', async () => {
    const { apiKeys } = await hooksFor({ resources: { apiKeys: { orgField: 'organizationId' } } })
    const data = await apiKeys.beforeUpdate(1, { name: 'renamed', userId: 'admin', organizationId: 'org-b', key: 'x' }, caller)
    expect(data).toEqual({ name: 'renamed' })
  })
})

describe('api token requests get through validation', () => {
  const apiKeys = sqliteTable('api_keys', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    key: text('key').notNull(),
    userId: text('user_id').notNull(),
    organizationId: text('organization_id'),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>(),
  })
  const context = { resource: 'apiKeys', registry: { apiKeys: { name: 'apiKeys', schema: apiKeys } }, runtimeConfig: {} } as any

  beforeEach(() => {
    globalThis.__autoApiPluginRegistry = undefined
  })

  it('a create body of only name and scopes passes — the hash, owner and organization are server-owned', async () => {
    await hooksFor({ resources: { apiKeys: { orgField: 'organizationId' } } })
    expect([...protectedFieldsFor(context, 'apiKeys', apiKeys, 'create')]).toEqual(expect.arrayContaining(['key', 'userId', 'organizationId']))

    const { create } = schemasFor(context, 'apiKeys', context.registry.apiKeys)
    const parsed = await create.safeParseAsync({ name: 'CI', scopes: ['articles:read'], userId: 'someone-else' })
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('userId')
  })

  it('`{ _rotate: true }` rotates although update validation drops the key', async () => {
    const middleware: any[] = []
    const hooks: Record<string, any> = {}
    await createApiTokenPlugin({ resources: { apiKeys: {} } }).runtimeSetup!({
      addHook: (resource: string, h: any) => { hooks[resource] = h },
      addMiddleware: (m: any) => middleware.push(m),
      addServerHandler: () => {},
      extendContext: () => {},
      logger: { info() {}, warn() {}, error() {}, debug() {} },
    } as any)

    const rotateFlag = middleware.find(m => m.name === 'api-token-rotate-flag')
    expect(rotateFlag).toMatchObject({ stage: 'pre-auth', resources: ['apiKeys'], operations: ['update'] })

    const request = { ...caller, event: { __body: { _rotate: true } } }
    await rotateFlag.handler(request)
    // What validation leaves of `{ _rotate: true }`: nothing.
    const data = await hooks.apiKeys.beforeUpdate(1, {}, request)
    expect(typeof data.key).toBe('string')
    expect(request._rawToken).toMatch(/^[0-9a-f]+$/)
  })
})

describe('api token bearer auth', () => {
  const apiKeys = sqliteTable('api_keys', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    userId: text('user_id').notNull(),
    organizationId: text('organization_id'),
  })
  const authUsers = sqliteTable('auth_users', { id: text('id').primaryKey(), email: text('email'), role: text('role') })
  const tokenRow = { id: 1, key: 'hash', userId: 'alice', organizationId: 'org-a' }
  const userRow = { id: 'alice', email: 'alice@example.test', role: 'user,superadmin' }

  async function authenticate(options: Parameters<typeof createApiTokenPlugin>[0], fullSchema: Record<string, any>) {
    let extender: any
    await createApiTokenPlugin(options).runtimeSetup!({
      addHook: () => {},
      addMiddleware: () => {},
      addServerHandler: () => {},
      extendContext: (fn: any) => { extender = fn },
      logger: { info() {}, warn() {}, error() {}, debug() {} },
    } as any)
    // Each table answers with its one row — what a hash match / id match returns.
    const rows = new Map<any, any>([[apiKeys, tokenRow], [authUsers, userRow]])
    const context = {
      event: { node: { req: { headers: { authorization: 'Bearer sk_raw' } } } },
      schema: { apiKeys },
      db: { _: { fullSchema }, select: () => ({ from: (t: any) => ({ where: async () => [rows.get(t)] }) }) },
    } as any
    await extender(context)
    return context
  }

  it('finds the token owner in the Drizzle schema when the user table is not a resource', async () => {
    const context = await authenticate({
      resources: { apiKeys: { userRelation: { resource: 'auth_users' }, orgField: 'organizationId' } },
      auth: { tokenPrefix: 'sk_' },
      cache: { enabled: false },
    }, { auth_users: authUsers })
    expect(context.authMethod).toBe('api-token')
    expect(context.user).toMatchObject({ id: 'alice', email: 'alice@example.test' })
    expect(context.tenant).toMatchObject({ id: 'org-a', field: 'organizationId' })
  })

  it('mapUser receives the token row, so a pinned organization can reach the user', async () => {
    const context = await authenticate({
      resources: { apiKeys: { userRelation: { resource: 'auth_users' }, orgField: 'organizationId' } },
      auth: { tokenPrefix: 'sk_' },
      cache: { enabled: false },
      mapUser: (u, t) => ({ id: u.id, email: u.email, roles: u.role.split(','), permissions: [], organizationId: t.organizationId }) as any,
    }, { auth_users: authUsers })
    expect(context.user).toMatchObject({ roles: ['user', 'superadmin'], organizationId: 'org-a' })
  })

  it('a user table that exists nowhere refuses the token and says why', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const context = await authenticate({
      resources: { apiKeys: { userRelation: { resource: 'user' } } },
      auth: { tokenPrefix: 'sk_' },
      cache: { enabled: false },
    }, { auth_users: authUsers })
    expect(context.user).toBeUndefined()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('User table "user"'))
    error.mockRestore()
  })
})

describe('api token hint', () => {
  const opts = { resources: { apiKeys: { hintField: 'keyHint' } }, auth: { tokenPrefix: 'sk_' } }

  it('a new token stores a hint of the issued token — its prefix and last 4 characters — and reveals the token once', async () => {
    const { apiKeys } = await hooksFor(opts)
    const request = { ...caller } as any
    const data = await apiKeys.beforeCreate({ name: 'ci' }, request)
    const raw = request._rawToken
    expect(raw).toMatch(/^sk_[0-9a-f]+$/)
    expect(data.keyHint).toBe(`sk_...${raw.slice(-4)}`)
    expect(data.key).not.toContain(raw.slice(-4))

    const created = await apiKeys.afterCreate({ id: 1, ...data }, request)
    expect(created.key).toBe(raw)
  })

  it('reads show the hint in the secret column, never characters of the stored hash', async () => {
    const { apiKeys } = await hooksFor(opts)
    const row = { id: 1, name: 'ci', key: 'f'.repeat(64), keyHint: 'sk_...a1b2' }
    expect(await apiKeys.afterGet(row, caller)).toMatchObject({ key: 'sk_...a1b2', keyHint: 'sk_...a1b2' })
    expect((await apiKeys.afterList([row], caller))[0].key).toBe('sk_...a1b2')
  })

  it('without a hint column, reads show only the prefix', async () => {
    const { apiKeys } = await hooksFor({ resources: { apiKeys: {} }, auth: { tokenPrefix: 'sk_' } })
    expect((await apiKeys.afterGet({ id: 1, key: 'abcdef0123456789' }, caller)).key).toBe('sk_...')
  })

  it('rotation writes a new hint; a plain update cannot set one', async () => {
    const { apiKeys } = await hooksFor(opts)
    const request = { ...caller, _rotateToken: true } as any
    const rotated = await apiKeys.beforeUpdate(1, {}, request)
    expect(rotated.keyHint).toBe(`sk_...${request._rawToken.slice(-4)}`)

    expect(await apiKeys.beforeUpdate(1, { name: 'x', keyHint: 'sk_...fake' }, caller)).toEqual({ name: 'x' })
  })
})
