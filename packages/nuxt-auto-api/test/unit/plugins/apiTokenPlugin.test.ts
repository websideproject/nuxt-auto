import { describe, it, expect } from 'vitest'
import { createApiTokenPlugin } from '../../../src/runtime/plugins/apiTokenPlugin'

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
