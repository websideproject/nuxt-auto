import { describe, it, expect, beforeEach } from 'vitest'
import { checkPermission, checkFieldPermission, getResourcePermissions } from '../../../src/runtime/server/utils/permissions'
import { hasPermission } from '../../../src/runtime/server/middleware/authz'
import { getPermissionEvaluators, registerPermissionEvaluator } from '../../../src/runtime/server/plugins/pluginRegistry'
import { createMockContext, createMockUser } from '../../helpers/mocks'

// The `/api/permissions` introspection path (`checkPermission` / `checkFieldPermission` /
// `getResourcePermissions`) shares `evaluatePermission` → `resolveObjectPermission` with the request
// gate (`hasPermission`), so introspection must answer IDENTICALLY — including for async function and
// structured-object (descriptor) gates. Previously untested.
describe('permissions introspection', () => {
  const ctx = createMockContext({ user: createMockUser('user'), permissions: ['read', 'user'] })
  beforeEach(() => { getPermissionEvaluators().splice(0) })

  describe('checkPermission', () => {
    it('no auth config → allowed', async () => {
      expect(await checkPermission('read', undefined, ctx)).toBe(true)
      expect(await checkPermission('read', { permissions: {} } as any, ctx)).toBe(true) // op unset = allowed
    })

    it('string / array permission matches the user’s permissions', async () => {
      expect(await checkPermission('read', { permissions: { read: 'read' } } as any, ctx)).toBe(true)
      expect(await checkPermission('create', { permissions: { create: 'admin' } } as any, ctx)).toBe(false)
      expect(await checkPermission('update', { permissions: { update: ['admin', 'user'] } } as any, ctx)).toBe(true)
    })

    it('async function permission is awaited', async () => {
      expect(await checkPermission('delete', { permissions: { delete: async (c: any) => !!c.user } } as any, ctx)).toBe(true)
    })

    it('structured-object permission routes through the evaluator chain (deny-closed)', async () => {
      registerPermissionEvaluator(async (v: any) => (v.plan === 'pro' ? true : undefined))
      expect(await checkPermission('create', { permissions: { create: { plan: 'pro' } } } as any, ctx)).toBe(true)
      expect(await checkPermission('create', { permissions: { create: { plan: 'free' } } } as any, ctx)).toBe(false)
    })
  })

  describe('checkFieldPermission', () => {
    it('no field config → allowed; configured read perm enforced', async () => {
      expect(await checkFieldPermission('email', 'read', { fields: {} } as any, ctx)).toBe(true)
      expect(await checkFieldPermission('email', 'read', { fields: { email: { read: 'read' } } } as any, ctx)).toBe(true)
      expect(await checkFieldPermission('ssn', 'read', { fields: { ssn: { read: 'admin' } } } as any, ctx)).toBe(false)
    })
  })

  describe('getResourcePermissions', () => {
    it('assembles the canCreate/Read/Update/Delete map + field-level permissions', async () => {
      const cfg = {
        permissions: { read: 'read', create: 'admin', update: 'user', delete: 'admin' },
        fields: { secret: { read: 'admin' } },
      }
      const res = await getResourcePermissions(cfg as any, ctx)
      expect(res).toMatchObject({ canRead: true, canCreate: false, canUpdate: true, canDelete: false })
      expect(res.fields!.secret).toEqual({ canRead: false, canWrite: true }) // write has no restriction
    })

    it('reflects object (descriptor) gates IDENTICALLY to the request gate hasPermission', async () => {
      registerPermissionEvaluator(async (v: any) => (v.gate === 'open' ? true : v.gate === 'shut' ? false : undefined))
      const open = { gate: 'open' }
      const shut = { gate: 'shut' }

      // introspection
      expect((await getResourcePermissions({ permissions: { create: open } } as any, ctx)).canCreate).toBe(true)
      expect((await getResourcePermissions({ permissions: { create: shut } } as any, ctx)).canCreate).toBe(false)
      // request gate — must agree
      expect(await hasPermission(ctx.permissions, open as any, ctx)).toBe(true)
      expect(await hasPermission(ctx.permissions, shut as any, ctx)).toBe(false)
    })
  })
})
