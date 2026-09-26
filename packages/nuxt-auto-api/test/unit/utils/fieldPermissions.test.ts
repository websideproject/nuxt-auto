import { describe, it, expect } from 'vitest'
import { assertWritableFields, deniedWriteFields, filterReadableFields } from '../../../src/runtime/server/utils/fieldPermissions'
import { createMockContext, createMockUser } from '../../helpers/mocks'

// S29.4 — `ResourceAuthConfig.fields[x].{read,write}` is enforced, not merely reported.
//
// Before this, `/api/<r>/permissions` said `canRead: false` for a column and the very next request
// returned it, and a PATCH to a `write: () => false` column returned 200 having written it. The read
// half had an implementation nothing called; the write half had none at all.

const ctx = (over: any = {}) => createMockContext({ user: createMockUser('user'), permissions: [], ...over }) as any
const withAuth = (fields: any, over: any = {}) => ({ ...ctx(over), effectiveAuth: { fields } })

describe('fields[x].write — a refusal, not a filter', () => {
  it('names every denied field in the 403, not just the first', async () => {
    const c = withAuth({ secret: { write: () => false }, locked: { write: () => false } })
    await expect(assertWritableFields({ title: 'ok', secret: 'x', locked: 'y' }, c))
      .rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('secret, locked') })
  })

  it('allows a field the caller MAY write', async () => {
    const c = withAuth({ secret: { write: (x: any) => !!x.user } })
    await expect(assertWritableFields({ secret: 'x' }, c)).resolves.toBeUndefined()
  })

  it('⚠ a read-only declaration does not restrict writing', async () => {
    // `{ read: isAdmin }` says nothing about writes, and reading it as a write denial would break every
    // resource in the monorepo that hides a column from non-admins but lets them set it.
    const c = withAuth({ notes: { read: () => false } })
    expect(await deniedWriteFields({ notes: 'hello' }, c)).toEqual([])
  })

  it('only gates fields the body actually contains', async () => {
    const c = withAuth({ secret: { write: () => false } })
    expect(await deniedWriteFields({ title: 'ok' }, c)).toEqual([])
  })

  it('401 rather than 403 when nobody is signed in', async () => {
    const c = withAuth({ secret: { write: () => false } }, { user: null })
    await expect(assertWritableFields({ secret: 'x' }, c)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('a resource with no field config is unrestricted', async () => {
    await expect(assertWritableFields({ anything: 1 }, ctx())).resolves.toBeUndefined()
  })
})

describe('fields[x].read — a filter, not a refusal', () => {
  it('strips the denied field and keeps the rest', async () => {
    const c = withAuth({ secret: { read: () => false } })
    expect(await filterReadableFields({ id: 1, title: 'x', secret: 'sh' }, c)).toEqual({ id: 1, title: 'x' })
  })

  it('strips it from every row of a list', async () => {
    const c = withAuth({ secret: { read: () => false } })
    const rows = [{ id: 1, secret: 'a' }, { id: 2, secret: 'b' }]
    expect(await filterReadableFields(rows, c)).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('keeps a field the caller MAY read', async () => {
    const c = withAuth({ email: { read: () => true } })
    expect(await filterReadableFields({ id: 1, email: 'a@b.c' }, c)).toEqual({ id: 1, email: 'a@b.c' })
  })

  it('honours a string permission the caller holds', async () => {
    const c = withAuth({ notes: { read: 'admin' } }, { permissions: ['admin'] })
    expect(await filterReadableFields({ id: 1, notes: 'n' }, c)).toEqual({ id: 1, notes: 'n' })
  })

  it('…and removes it when they do not', async () => {
    const c = withAuth({ notes: { read: 'admin' } }, { permissions: ['read'] })
    expect(await filterReadableFields({ id: 1, notes: 'n' }, c)).toEqual({ id: 1 })
  })

  it('⚠ the `*` wildcard does NOT open a field gate', async () => {
    // `hasPermission` (the OPERATION gate) returns true for `*` before looking at anything else. Field
    // gates go through `checkFieldPermission`/`evaluatePermission` instead, which does not — otherwise a
    // platform admin would read a column whose declaration says "not even by a platform admin", and
    // enforcement would disagree with what `/permissions` reports to that same admin.
    const c = withAuth({ secret: { read: () => false } }, { permissions: ['*'] })
    expect(await filterReadableFields({ id: 1, secret: 'sh' }, c)).toEqual({ id: 1 })
    const w = withAuth({ secret: { write: () => false } }, { permissions: ['*'] })
    expect(await deniedWriteFields({ secret: 'x' }, w)).toEqual(['secret'])
  })

  it('a write-only declaration does not hide the field on read', async () => {
    const c = withAuth({ token: { write: () => false } })
    expect(await filterReadableFields({ id: 1, token: 't' }, c)).toEqual({ id: 1, token: 't' })
  })

  it('does not mutate the row it was handed', async () => {
    const c = withAuth({ secret: { read: () => false } })
    const row = { id: 1, secret: 'sh' }
    await filterReadableFields(row, c)
    expect(row.secret, 'the caller\'s object is untouched — hooks may still need the value').toBe('sh')
  })

  it('⚠ ROOT RESOURCE ONLY — a nested relation is not filtered', async () => {
    // Pinned rather than implied. `fields` belongs to the resource that declared it, and the registry
    // cannot map an `?include=` relation key back to a resource name today, so a denied column reached
    // through a relation still comes back. Filtering by NAME across resources (what `hiddenFields` does)
    // is not an option here: `content`, `error`, `metadata` and `scheduledFor` are each restricted on one
    // resource and ordinary columns on several others.
    const c = withAuth({ secret: { read: () => false } })
    const row = { id: 1, secret: 'sh', child: { id: 2, secret: 'also-secret' } }
    expect(await filterReadableFields(row, c)).toEqual({ id: 1, child: { id: 2, secret: 'also-secret' } })
  })
})

describe('where the config comes from', () => {
  it('prefers the MERGED config over the module\'s own declaration', async () => {
    // `effectiveAuth` has the nuxt.config override folded in; `resourceConfig.authorization` does not.
    const c = {
      ...ctx(),
      resourceConfig: { authorization: { fields: { a: { read: () => false } } } },
      effectiveAuth: { fields: { b: { read: () => false } } },
    }
    expect(await filterReadableFields({ a: 1, b: 2 }, c as any)).toEqual({ a: 1 })
  })

  it('falls back to the resource config when nothing was merged', async () => {
    const c = { ...ctx(), resourceConfig: { authorization: { fields: { a: { read: () => false } } } } }
    expect(await filterReadableFields({ a: 1, b: 2 }, c as any)).toEqual({ b: 2 })
  })
})
