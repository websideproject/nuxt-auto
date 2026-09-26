import { describe, it, expect } from 'vitest'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { HandlerContext } from '../../../src/runtime/types'
import { protectedFieldsFor, stripProtectedFields } from '../../../src/runtime/server/utils/protectedFields'

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title'),
  organizationId: text('organization_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: text('deleted_by'),
  deletionId: text('deletion_id'),
})

const ctx = (over: Partial<HandlerContext> = {}): HandlerContext => ({
  db: null, schema: { posts }, user: null, permissions: [], params: {}, query: {}, validated: {}, event: {} as any,
  resource: 'posts', operation: 'create', runtimeConfig: { autoApi: {} }, ...over,
}) as HandlerContext

describe('protected fields', () => {
  it('create: soft-delete and audit columns, and a primary key the database generates (not createdAt)', () => {
    expect([...protectedFieldsFor(ctx(), 'posts', posts, 'create')].sort())
      .toEqual(['createdBy', 'deletedAt', 'deletedBy', 'deletionId', 'id', 'updatedBy'])
  })

  it('create: a text primary key the database does not generate stays writable (client-made ids)', () => {
    const docs = sqliteTable('docs', { id: text('id').primaryKey(), title: text('title') })
    expect(protectedFieldsFor(ctx(), 'docs', docs, 'create').has('id')).toBe(false)
  })

  it('update: also the primary key and createdAt', () => {
    expect([...protectedFieldsFor(ctx(), 'posts', posts, 'update')].sort())
      .toEqual(['createdAt', 'createdBy', 'deletedAt', 'deletedBy', 'deletionId', 'id', 'updatedBy'])
  })

  it('the tenant column on scoped resources — unless the caller is a cross-tenant operator', () => {
    const tenancy = { runtimeConfig: { autoApi: { multiTenancy: { enabled: true } } } } as any
    expect(protectedFieldsFor(ctx(tenancy), 'posts', posts, 'create').has('organizationId')).toBe(true)
    const operator = { ...tenancy, tenant: { id: 'o1', field: 'organizationId', canAccessAllTenants: true } }
    expect(protectedFieldsFor(ctx(operator), 'posts', posts, 'create').has('organizationId')).toBe(false)
  })

  it('a tenant set by an extender protects the column even with multi-tenancy off', () => {
    const c = ctx({ tenant: { id: 'o1', field: 'organizationId', canAccessAllTenants: false } })
    expect(protectedFieldsFor(c, 'posts', posts, 'update').has('organizationId')).toBe(true)
  })

  it('plus the registration\'s own protectedFields', () => {
    const c = ctx({ registry: { posts: { name: 'posts', schema: posts, protectedFields: ['title'] } } })
    expect(protectedFieldsFor(c, 'posts', posts, 'create').has('title')).toBe(true)
  })

  it('stripProtectedFields drops them and keeps the rest', () => {
    expect(stripProtectedFields({ id: 1, title: 'x', deletedAt: null }, new Set(['id', 'deletedAt']))).toEqual({ title: 'x' })
  })
})
