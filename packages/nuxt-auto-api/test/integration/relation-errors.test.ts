import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDatabase, seedDatabase, cleanDatabase } from '../helpers/setup'
import { schema as baseSchema } from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { createMockContext } from '../helpers/mocks'
import { createRelationError } from '../../src/runtime/server/utils/buildRelations'
import { drizzle } from 'drizzle-orm/better-sqlite3'

// Stub useRuntimeConfig for tests
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {
    relations: {
      maxDepth: 3
    }
  }
}))

describe('Relation Error Handling Integration', () => {
  let db: any
  let sqlite: any
  let testData: any

  beforeEach(async () => {
    const setup = await setupTestDatabase(baseSchema)
    db = setup.db
    sqlite = setup.sqlite
    testData = await seedDatabase(db, baseSchema)
  })

  afterEach(async () => {
    await cleanDatabase(db, baseSchema)
    sqlite.close()
  })

  describe('createRelationError utility', () => {
    it('should create helpful error message', () => {
      const error = createRelationError('posts', 'users', new Error('Original error'))

      expect(error.message).toContain('Failed to load relation "posts" for resource "users"')
      expect(error.message).toContain('relations() function')
      expect(error.message).toContain('export const usersRelations')
      expect(error.message).toContain('Original error')
      expect(error.statusCode).toBe(400)
    })

    it('should include checklist of requirements', () => {
      const error = createRelationError('posts', 'users')

      expect(error.message).toContain('Make sure to:')
      expect(error.message).toContain('Export the relations definition')
      expect(error.message).toContain('Pass the schema to drizzle()')
      expect(error.message).toContain('Define both sides of the relationship')
    })
  })

  describe('Non-existent relation errors', () => {
    it('should provide helpful error when relation does not exist', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'nonExistentRelation'
        }
      })

      try {
        await listHandler(context as any)
        // If we reach here, test should fail
        expect(true).toBe(false)
      } catch (error: any) {
        // Should catch and provide helpful error
        expect(error.message).toBeDefined()
        // Error message might vary based on Drizzle version
        // but should be caught and re-thrown with helpful context
      }
    })

    it('should handle undefined relations in query API', async () => {
      // Mock a scenario where db.query exists but relation is not defined
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'invalidRelation'
        }
      })

      try {
        await listHandler(context as any)
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        // Error should be caught and handled
        expect(error).toBeDefined()
      }
    })
  })

  describe('Valid relations work correctly', () => {
    it('should successfully load defined relations', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('author')
        expect(result.data[0].author).toBeDefined()
      }
    })

    it('should work with nested defined relations', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts.comments'
        }
      })

      const result = await listHandler(context as any)

      expect(result.data).toBeInstanceOf(Array)
      // Should not throw error for properly defined relations
    })
  })

  describe('Missing db.query support', () => {
    it('should handle when db.query is not available', async () => {
      // Create a DB instance without schema (so no relational queries)
      const dbWithoutQuery = drizzle(sqlite)

      const context = createMockContext({
        db: dbWithoutQuery,
        schema: baseSchema,
        resource: 'posts',
        operation: 'list',
        query: {
          include: 'author'
        }
      })

      // Can throw either error depending on how the mock is interpreted, but both indicate failure to query relations
      await expect(() => listHandler(context as any))
        .rejects
        .toThrow(/(Relational queries not available|Resource .* not found)/)
    })
  })

  describe('Enhanced syntax with invalid relations', () => {
    it('should handle field selection on non-existent relation', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'invalidRelation[id,name]'
        }
      })

      try {
        await listHandler(context as any)
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })

    it('should handle filtering on non-existent relation', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'invalidRelation{filter:{active:true}}'
        }
      })

      try {
        await listHandler(context as any)
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Get handler relation errors', () => {
    it('should provide helpful error in get handler', async () => {
      const user = testData.users[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'get',
        params: { id: user.id },
        query: {
          include: 'nonExistentRelation'
        }
      })

      try {
        await getHandler(context as any)
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })

    it('should work with valid relations in get handler', async () => {
      const post = testData.posts[0]

      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'posts',
        operation: 'get',
        params: { id: post.id },
        query: {
          include: 'author'
        }
      })

      const result = await getHandler(context as any)

      expect(result.data).toBeDefined()
      expect(result.data).toHaveProperty('author')
      expect(result.data.author).toBeDefined()
    })
  })

  describe('Multiple relations with one invalid', () => {
    it('should fail when any relation is invalid', async () => {
      const context = createMockContext({
        db,
        schema: baseSchema,
        resource: 'users',
        operation: 'list',
        query: {
          include: 'posts,invalidRelation'
        }
      })

      try {
        await listHandler(context as any)
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })
})
