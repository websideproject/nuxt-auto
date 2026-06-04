import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hasPermission } from '../../../src/runtime/server/middleware/authz'
import { resolveObjectPermission } from '../../../src/runtime/server/middleware/resolveObjectPermission'
import { getPermissionEvaluators, registerPermissionEvaluator } from '../../../src/runtime/server/plugins/pluginRegistry'
import { createMockContext, createMockUser } from '../../helpers/mocks'

// NEW behaviour (commits "Improve permissions" / "Improve authorization flexibility"): `hasPermission`
// now also accepts an ASYNC function and a STRUCTURED OBJECT permission. Object permissions are routed
// through the generic evaluator seam (`resolveObjectPermission` → registered evaluators), which is how
// the access/entitlements modules plug domain logic in WITHOUT auto-api knowing the shape. The seam is
// deny-closed: an unhandled object value must NOT grant access.
describe('hasPermission — async function + structured object (NEW)', () => {
  const ctx = createMockContext({ user: createMockUser('user'), permissions: ['read'] })

  // The evaluator registry is process-global — isolate each test.
  beforeEach(() => { getPermissionEvaluators().splice(0) })

  it('still resolves wildcard / string / array forms', async () => {
    expect(await hasPermission(['*'], 'anything', ctx)).toBe(true)
    expect(await hasPermission(['read'], 'read', ctx)).toBe(true)
    expect(await hasPermission(['read'], 'write', ctx)).toBe(false)
    expect(await hasPermission(['read'], ['write', 'read'], ctx)).toBe(true)
  })

  it('awaits an ASYNC function permission', async () => {
    expect(await hasPermission([], async (c: any) => c.user?.id === ctx.user!.id, ctx)).toBe(true)
    expect(await hasPermission([], async () => false, ctx)).toBe(false)
  })

  it('still supports a sync function permission', async () => {
    expect(await hasPermission([], () => true, ctx)).toBe(true)
  })

  it('routes a structured OBJECT permission to a registered evaluator', async () => {
    registerPermissionEvaluator(async (value: any) => (value.plan === 'pro' ? true : undefined))
    expect(await hasPermission([], { plan: 'pro' } as any, ctx)).toBe(true)
    expect(await hasPermission([], { plan: 'free' } as any, ctx), 'evaluator returns undefined → deny-closed').toBe(false)
  })

  it('an object permission with NO registered evaluator denies closed (and warns)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await hasPermission([], { gate: 'mystery' } as any, ctx)).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('resolveObjectPermission — evaluator chain', () => {
  const ctx = createMockContext({ user: createMockUser('user') })
  beforeEach(() => { getPermissionEvaluators().splice(0) })

  it('uses the FIRST evaluator that returns a boolean (undefined = pass to next)', async () => {
    const a = vi.fn(async () => undefined) // not mine
    const b = vi.fn(async () => true) // handles it
    const c = vi.fn(async () => false) // should never run
    registerPermissionEvaluator(a as any)
    registerPermissionEvaluator(b as any)
    registerPermissionEvaluator(c as any)

    expect(await resolveObjectPermission({ x: 1 }, ctx as any)).toBe(true)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(c, 'short-circuits once an evaluator decides').not.toHaveBeenCalled()
  })

  it('a false decision short-circuits too (not just true)', async () => {
    const a = vi.fn(async () => false)
    const b = vi.fn(async () => true)
    registerPermissionEvaluator(a as any)
    registerPermissionEvaluator(b as any)
    expect(await resolveObjectPermission({ x: 1 }, ctx as any)).toBe(false)
    expect(b).not.toHaveBeenCalled()
  })

  it('denies closed when every evaluator passes (all undefined)', async () => {
    registerPermissionEvaluator(async () => undefined)
    registerPermissionEvaluator(async () => undefined)
    expect(await resolveObjectPermission({ x: 1 }, ctx as any)).toBe(false)
  })

  it('denies closed when there are no evaluators at all', async () => {
    expect(await resolveObjectPermission({ x: 1 }, ctx as any)).toBe(false)
  })
})
