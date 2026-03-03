import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { m2mListHandler } from '../../src/runtime/server/handlers/m2m/list'
import { m2mSyncHandler } from '../../src/runtime/server/handlers/m2m/sync'
import { m2mAddHandler } from '../../src/runtime/server/handlers/m2m/add'
import { m2mRemoveHandler } from '../../src/runtime/server/handlers/m2m/remove'
import { createMockContext } from '../helpers/mocks'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
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
      } catch (error) {
        sqlite.prepare('ROLLBACK TO SAVEPOINT test_tx').run()
        throw error
      }
    }

    // Seed tags
    tags = await db.insert(baseSchema.tags).values([
      { name: 'Vue' },
      { name: 'Nuxt' },
      { name: 'TypeScript' },
      { name: 'Drizzle' }
    ]).returning()

    // Add initial relations: Post 1 has 'Vue' and 'Nuxt'
    await db.insert(baseSchema.postTags).values([
      { postId: testData.posts[0].id, tagId: tags[0].id },
      { postId: testData.posts[0].id, tagId: tags[1].id }
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
      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list', // Operation context
        params: { id: postId, relation: 'tags' },
        validated: { query: {} }
      })

      const initialList = await m2mListHandler(listContext as any)
      expect(initialList.ids).toHaveLength(2)
      expect(initialList.ids).toContain(tags[0].id)
      expect(initialList.ids).toContain(tags[1].id)

      // 2. SYNC: Update relations
      const syncContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'sync',
        params: { id: postId, relation: 'tags' },
        event: { method: 'POST' },
        validated: { body: { ids: [tags[1].id, tags[2].id, tags[3].id] } }
      })

      const syncResult = await m2mSyncHandler(syncContext as any)
      expect(syncResult.success).toBe(true)
      expect(syncResult.added).toBe(2) // TypeScript, Drizzle
      expect(syncResult.removed).toBe(1) // Vue
      expect(syncResult.total).toBe(3)

      // 3. VERIFY: List again to confirm
      const verifyContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: {} }
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

      const addContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'add',
        params: { id: postId, relation: 'tags' },
        event: { method: 'POST' },
        validated: { body: { ids: [tags[2].id] } }
      })

      const addResult = await m2mAddHandler(addContext as any)
      expect(addResult.added).toBe(1)
      expect(addResult.total).toBe(3)

      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: {} }
      })
      const list = await m2mListHandler(listContext as any)
      expect(list.ids).toContain(tags[2].id)
    })

    it('should remove existing relations', async () => {
      const postId = testData.posts[0].id

      const removeContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'remove',
        params: { id: postId, relation: 'tags' },
        event: { method: 'DELETE' },
        validated: { body: { ids: [tags[0].id] } }
      })

      const removeResult = await m2mRemoveHandler(removeContext as any)
      expect(removeResult.removed).toBe(1)
      expect(removeResult.total).toBe(1)

      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: {} }
      })
      const list = await m2mListHandler(listContext as any)
      expect(list.ids).not.toContain(tags[0].id)
    })
  })

  describe('List Operations with options', () => {
    it('should include full records if requested', async () => {
      const postId = testData.posts[0].id

      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: postId, relation: 'tags' },
        validated: { query: { includeRecords: true } }
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
      const listContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        params: { id: 9999, relation: 'tags' },
        validated: { query: {} }
      })

      await expect(m2mListHandler(listContext as any)).rejects.toThrow(/not found/)
    })

    it('should return 404 if right records do not exist on sync', async () => {
      const postId = testData.posts[0].id

      const syncContext = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'sync',
        params: { id: postId, relation: 'tags' },
        event: { method: 'POST' },
        validated: { body: { ids: [9999] } }
      })

      await expect(m2mSyncHandler(syncContext as any)).rejects.toThrow(/not found/)
    })
  })
})
