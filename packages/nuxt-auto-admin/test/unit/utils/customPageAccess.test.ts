import { describe, it, expect } from 'vitest'
import { grantsAll } from '../../../src/runtime/utils/customPageAccess'
import { assertNoAccessFunctions } from '../../../src/module'

const perms = {
  users: { canRead: true, canUpdate: false },
  orders: { canRead: true, canUpdate: true },
}

describe('custom page permissions', () => {
  it('grants when every "<resource>:<action>" is allowed', () => {
    expect(grantsAll(perms, 'orders:update')).toBe(true)
    expect(grantsAll(perms, ['orders:update', 'users:read'])).toBe(true)
    expect(grantsAll(perms, undefined)).toBe(true)
  })

  it('denies when any is not allowed, unknown, or malformed', () => {
    expect(grantsAll(perms, ['orders:update', 'users:update'])).toBe(false)
    expect(grantsAll(perms, 'invoices:read')).toBe(false)
    expect(grantsAll(perms, 'admin')).toBe(false)
    expect(grantsAll(perms, 'users:write')).toBe(false)
    expect(grantsAll(perms, 'users:read:extra')).toBe(false)
    expect(grantsAll(undefined, 'users:read')).toBe(false)
  })
})

describe('access options that cannot reach the running app', () => {
  it('rejects an `access` function and a custom page `canAccess` function', () => {
    expect(() => assertNoAccessFunctions({ access: (() => true) as never })).toThrow(/autoAdmin.middleware/)
    expect(() => assertNoAccessFunctions({
      customPages: [{ name: 'settings', label: 'Settings', path: 'settings', icon: 'i-lucide-cog', canAccess: (() => true) as never }],
    })).toThrow(/permissions/)
  })

  it('accepts middleware and permission strings', () => {
    expect(() => assertNoAccessFunctions({
      middleware: 'auth',
      customPages: [{ name: 'settings', label: 'Settings', path: 'settings', icon: 'i-lucide-cog', permissions: 'users:update' }],
    })).not.toThrow()
  })
})
