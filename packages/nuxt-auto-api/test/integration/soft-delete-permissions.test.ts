import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { createMockContext } from '../helpers/mocks'
import { setRegistry, resetRegistry } from '../helpers/registry-stub'
import { deleteHandler } from '../../src/runtime/server/handlers/delete'
import { restoreHandler } from '../../src/runtime/server/handlers/restore'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { registerPermissionEvaluator } from '../../src/runtime/server/plugins/pluginRegistry'

vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, autoApi: {} }))

// A gate-descriptor evaluator (entitlement seam). Handles `{ gate: 'x' }` by checking the user's
// permissions for that gate; defers (undefined) on anything else so other tests are unaffected.
registerPermissionEvaluator((value: any, ctx: any) => {
  if (value && typeof value === 'object' && typeof value.gate === 'string') {
    return (ctx.permissions ?? []).includes(value.gate)
  }
  return undefined
})

describe('Soft-delete restore/purge permission config', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)
    resetRegistry()
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
    resetRegistry()
  })

  async function softDeleteFirst(): Promise<number> {
    const postId = testData.posts[0].id
    await db.update(baseSchema.posts).set({ deletedAt: new Date() }).where(eq(baseSchema.posts.id, postId))
    return postId
  }

  function ctx(opts: { perms?: string[], op?: string, id?: number, query?: any }) {
    return createMockContext({
      db,
      schema: baseSchema,
      resource: 'posts',
      operation: opts.op ?? 'update',
      params: opts.id ? { id: String(opts.id) } : {},
      query: opts.query ?? {},
      permissions: opts.perms ?? [],
      user: { id: 1, permissions: opts.perms ?? [] },
    })
  }

  // ── restore config override ──────────────────────────────────────────────
  describe('restore', () => {
    it('default (no config) → admin restores, non-admin 403', async () => {
      const id = await softDeleteFirst()
      await expect(restoreHandler(ctx({ perms: ['user'], id }) as any)).rejects.toMatchObject({ statusCode: 403 })

      const id2 = testData.posts[1].id
      await db.update(baseSchema.posts).set({ deletedAt: new Date() }).where(eq(baseSchema.posts.id, id2))
      const res = await restoreHandler(ctx({ perms: ['admin'], id: id2 }) as any)
      expect(res.restored).toBe(true)
    })

    it('permissions.restore overrides the default (editor allowed)', async () => {
      setRegistry({ posts: { authorization: { permissions: { restore: 'editor' } } } })
      const id = await softDeleteFirst()
      const res = await restoreHandler(ctx({ perms: ['editor'], id }) as any)
      expect(res.restored).toBe(true)
    })

    it('permissions.restore denies a caller lacking it', async () => {
      setRegistry({ posts: { authorization: { permissions: { restore: 'editor' } } } })
      const id = await softDeleteFirst()
      await expect(restoreHandler(ctx({ perms: ['user'], id }) as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('softDelete.restore block works when permissions.restore is unset', async () => {
      setRegistry({ posts: { authorization: { softDelete: { restore: 'editor' } } } })
      const id = await softDeleteFirst()
      expect((await restoreHandler(ctx({ perms: ['editor'], id }) as any)).restored).toBe(true)
    })

    it('permissions.restore takes precedence over softDelete.restore', async () => {
      setRegistry({ posts: { authorization: { permissions: { restore: 'admin' }, softDelete: { restore: 'editor' } } } })
      const id = await softDeleteFirst()
      // editor satisfies softDelete.restore but NOT permissions.restore (which wins) → denied
      await expect(restoreHandler(ctx({ perms: ['editor'], id }) as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('entitlement gate descriptor routes through the evaluator seam', async () => {
      setRegistry({ posts: { authorization: { permissions: { restore: { gate: 'trash:restore' } } } } })
      const id = await softDeleteFirst()
      await expect(restoreHandler(ctx({ perms: ['user'], id }) as any)).rejects.toMatchObject({ statusCode: 403 })

      const id2 = testData.posts[1].id
      await db.update(baseSchema.posts).set({ deletedAt: new Date() }).where(eq(baseSchema.posts.id, id2))
      expect((await restoreHandler(ctx({ perms: ['trash:restore'], id: id2 }) as any)).restored).toBe(true)
    })
  })

  // ── purge (force=true) config override ────────────────────────────────────
  describe('purge', () => {
    it('default → admin purges (hard delete), non-admin 403', async () => {
      const id = await softDeleteFirst()
      await expect(
        deleteHandler(ctx({ perms: ['user'], op: 'delete', id, query: { force: 'true' } }) as any),
      ).rejects.toMatchObject({ statusCode: 403 })

      const res = await deleteHandler(ctx({ perms: ['admin'], op: 'delete', id, query: { force: 'true' } }) as any)
      expect(res.success).toBe(true)
      expect(res.softDeleted).toBe(false)
      const [gone] = await db.select().from(baseSchema.posts).where(eq(baseSchema.posts.id, id))
      expect(gone).toBeUndefined()
    })

    it('permissions.purge override (editor can purge)', async () => {
      setRegistry({ posts: { authorization: { permissions: { purge: 'editor' } } } })
      const id = await softDeleteFirst()
      const res = await deleteHandler(ctx({ perms: ['editor'], op: 'delete', id, query: { force: 'true' } }) as any)
      expect(res.softDeleted).toBe(false)
    })

    it('softDelete.purge override', async () => {
      setRegistry({ posts: { authorization: { softDelete: { purge: 'editor' } } } })
      const id = await softDeleteFirst()
      await expect(
        deleteHandler(ctx({ perms: ['user'], op: 'delete', id, query: { force: 'true' } }) as any),
      ).rejects.toMatchObject({ statusCode: 403 })
      expect((await deleteHandler(ctx({ perms: ['editor'], op: 'delete', id, query: { force: 'true' } }) as any)).softDeleted).toBe(false)
    })
  })

  // ── viewDeleted gate ──────────────────────────────────────────────────────
  describe('viewDeleted', () => {
    it('permissions.viewDeleted lets a non-admin see trash via includeDeleted', async () => {
      const id = await softDeleteFirst()
      const resourceConfig = { authorization: { permissions: { viewDeleted: 'editor' } } }

      // editor with viewDeleted + includeDeleted → sees the trashed row
      const editorCtx = createMockContext({
        db, schema: baseSchema, resource: 'posts', operation: 'list',
        query: { includeDeleted: 'true' }, permissions: ['editor'],
        user: { id: 1, permissions: ['editor'] }, resourceConfig,
      })
      const editorList = await listHandler(editorCtx as any)
      expect(editorList.data.find((p: any) => p.id === id)).toBeDefined()

      // plain user → trash stays hidden even with includeDeleted
      const userCtx = createMockContext({
        db, schema: baseSchema, resource: 'posts', operation: 'list',
        query: { includeDeleted: 'true' }, permissions: ['user'],
        user: { id: 1, permissions: ['user'] }, resourceConfig,
      })
      const userList = await listHandler(userCtx as any)
      expect(userList.data.find((p: any) => p.id === id)).toBeUndefined()
    })
  })
})
