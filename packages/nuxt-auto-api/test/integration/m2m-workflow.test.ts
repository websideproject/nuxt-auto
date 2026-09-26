import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { m2mListHandler } from '../../src/runtime/server/handlers/m2m/list'
import { m2mSyncHandler } from '../../src/runtime/server/handlers/m2m/sync'
import { m2mAddHandler } from '../../src/runtime/server/handlers/m2m/add'
import { m2mRemoveHandler } from '../../src/runtime/server/handlers/m2m/remove'
import { createMockContext } from '../helpers/mocks'
import { registryFor } from '../helpers/context'

// A real request context carries the registry (every resource open here — this file is about M2M mechanics).
const m2mCtx = (overrides: any) => createMockContext({ registry: registryFor(baseSchema), runtimeConfig: { autoApi: {} }, ...overrides })

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {},
}))

describe('M2M Integration Workflow', () => {
  let db: any
  let sqlite: any
  let testData: any
  let tags: any[]

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)

    // Mock transaction to support async callback (needed for better-sqlite3 in tests)
    db.transaction = async (fn: any) => {
      sqlite.prepare('SAVEPOINT test_tx').run()
      try {
        const result = await fn(db)
        sqlite.prepare('RELEASE SAVEPOINT test_tx').run()
        return result
      }
      catch (error) {
        sqlite.prepare('ROLLBACK TO SAVEPOINT test_tx').run()
        throw error
      }
    }

    // Seed tags
    tags = await db.insert(baseSchema.tags).values([
      { name: 'Vue' },
      { name: 'Nuxt' },
      { name: 'TypeScript' },
      { name: 'Drizzle' },
    ]).returning()

    // Add initial relations: Post 1 has 'Vue' and 'Nuxt'
    await db.insert(baseSchema.postTags).values([
      { postId: testData.posts[0].id, tagId: tags[0].id },
      { postId: testData.posts[0].id, tagId: tags[1].id },
    ])
  })

  afterEach(async () => {
    await db.delete(baseSchema.postTags)
    await db.delete(baseSchema.tags)
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('Full M2M Sync Workflow', () => {
    it('should list → sync → verify relations', async () => {
      const postId = testData.posts[0].id

      // 1. LIST: Get current relations
      const listContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list', // Operation context
        params: { id: postId, relation: 'tags' },
        validated: { query: {} },
      })

      const initialList = await m2mListHandler(listContext as any)
      expect(initialList.ids).toHaveLength(2)
      expect(initialList.ids).toContain(tags[0].id)
      expect(initialList.ids).toContain(tags[1].id)

      // 2. SYNC: Update relations
      const syncContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'sync',
        params: { id: postId, relation: 'tags' },
        event: { method: 'POST' },
        validated: { body: { ids: [tags[1].id, tags[2].id, tags[3].id] } },
      })

      const syncResult = await m2mSyncHandler(syncContext as any)
      expect(syncResult.success).toBe(true)
      expect(syncResult.added).toBe(2) // TypeScript, Drizzle
      expect(syncResult.removed).toBe(1) // Vue
      expect(syncResult.total).toBe(3)

      // 3. VERIFY: List again to confirm
      const verifyContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: {} },
      })

      const finalList = await m2mListHandler(verifyContext as any)
      expect(finalList.ids).toHaveLength(3)
      expect(finalList.ids).toContain(tags[1].id)
      expect(finalList.ids).toContain(tags[2].id)
      expect(finalList.ids).toContain(tags[3].id)
    })
  })

  describe('Add/Remove Operations', () => {
    it('should incrementally add new relations', async () => {
      const postId = testData.posts[0].id

      const addContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'add',
        params: { id: postId, relation: 'tags' },
        event: { method: 'POST' },
        validated: { body: { ids: [tags[2].id] } },
      })

      const addResult = await m2mAddHandler(addContext as any)
      expect(addResult.added).toBe(1)
      expect(addResult.total).toBe(3)

      const listContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: {} },
      })
      const list = await m2mListHandler(listContext as any)
      expect(list.ids).toContain(tags[2].id)
    })

    it('should remove existing relations', async () => {
      const postId = testData.posts[0].id

      const removeContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'remove',
        params: { id: postId, relation: 'tags' },
        event: { method: 'DELETE' },
        validated: { body: { ids: [tags[0].id] } },
      })

      const removeResult = await m2mRemoveHandler(removeContext as any)
      expect(removeResult.removed).toBe(1)
      expect(removeResult.total).toBe(1)

      const listContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: {} },
      })
      const list = await m2mListHandler(listContext as any)
      expect(list.ids).not.toContain(tags[0].id)
    })
  })

  describe('List Operations with options', () => {
    it('should include full records if requested', async () => {
      const postId = testData.posts[0].id

      const listContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: { includeRecords: true } },
      })

      const listResult = await m2mListHandler(listContext as any)
      expect(listResult.records).toBeDefined()
      expect(listResult.records).toHaveLength(2)
      expect(listResult.records![0]).toHaveProperty('name')
      expect(listResult.records![0].name).toMatch(/Vue|Nuxt/)
    })
  })

  describe('Error Handling', () => {
    it('should return 404 if left record does not exist', async () => {
      const listContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: 9999, relation: 'tags' },
        validated: { query: {} },
      })

      await expect(m2mListHandler(listContext as any)).rejects.toThrow(/not found/)
    })

    it('should return 404 if right records do not exist on sync', async () => {
      const postId = testData.posts[0].id

      const syncContext = m2mCtx({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'sync',
        params: { id: postId, relation: 'tags' },
        event: { method: 'POST' },
        validated: { body: { ids: [9999] } },
      })

      await expect(m2mSyncHandler(syncContext as any)).rejects.toThrow(/not found/)
    })
  })

  // `permissions.m2m` on the LEFT resource. Both settings are keyed by relation name (the `:relation` segment).
  describe('permissions.m2m', () => {
    const READ_ONLY_TAGS = { permissions: { read: true } }
    const OPEN_POSTS = { permissions: { read: true, create: true, update: true, delete: true } }

    function syncAs(m2m: any, ids: any[], tagsAuth: any = READ_ONLY_TAGS) {
      return m2mCtx({
        db,
        schema: baseSchema,
        registry: registryFor(baseSchema, { posts: { ...OPEN_POSTS, permissions: { ...OPEN_POSTS.permissions, m2m } }, tags: tagsAuth }),
        resource: 'posts',
        operation: 'sync',
        user: { id: 1 },
        params: { id: testData.posts[0].id, relation: 'tags' },
        event: { method: 'POST' },
        validated: { body: { ids } },
      })
    }

    it('links with only `read` on the related resource by default', async () => {
      await expect(m2mSyncHandler(syncAs(undefined, [tags[2].id]) as any)).resolves.toBeTruthy()
    })

    it('requireUpdateOnRelated names the relation: `read` alone is refused', async () => {
      await expect(m2mSyncHandler(syncAs({ requireUpdateOnRelated: ['tags'] }, [tags[2].id]) as any)).rejects.toMatchObject({ statusCode: 403 })
      // …and passes once the caller may update tags
      const open = { permissions: { read: true, update: true } }
      await expect(m2mSyncHandler(syncAs({ requireUpdateOnRelated: ['tags'] }, [tags[2].id], open) as any)).resolves.toBeTruthy()
    })

    it('requireUpdateToLink applies to every relation', async () => {
      await expect(m2mSyncHandler(syncAs({ requireUpdateToLink: true }, [tags[2].id]) as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('relations[name].check is looked up by relation name and sees both sides', async () => {
      let seen: any
      const check = (ctx: any) => {
        seen = ctx
        return !ctx.right.records.some((t: any) => t.name === 'Drizzle')
      }
      await expect(m2mSyncHandler(syncAs({ relations: { tags: { check } } }, [tags[3].id]) as any)).rejects.toMatchObject({ statusCode: 403 })
      expect(seen).toMatchObject({ operation: 'sync', left: { resource: 'posts' }, right: { resource: 'tags', ids: [tags[3].id] } })
      expect(seen.left.record.id).toBe(testData.posts[0].id)

      await expect(m2mSyncHandler(syncAs({ relations: { tags: { check } } }, [tags[2].id]) as any)).resolves.toBeTruthy()
    })

    it('a check that throws without a status is a 403; one with a status keeps it', async () => {
      const refuse = () => {
        throw new Error('no')
      }
      const plain = { relations: { tags: { check: refuse } } }
      await expect(m2mSyncHandler(syncAs(plain, [tags[2].id]) as any)).rejects.toMatchObject({ statusCode: 403 })
      const payFirst = () => {
        throw Object.assign(new Error('pay'), { statusCode: 402 })
      }
      const withStatus = { relations: { tags: { check: payFirst } } }
      await expect(m2mSyncHandler(syncAs(withStatus, [tags[2].id]) as any)).rejects.toMatchObject({ statusCode: 402 })
    })

    it('a check for another relation does not run', async () => {
      const other = { relations: { categories: { check: () => false } } }
      await expect(m2mSyncHandler(syncAs(other, [tags[2].id]) as any)).resolves.toBeTruthy()
    })
  })
})
