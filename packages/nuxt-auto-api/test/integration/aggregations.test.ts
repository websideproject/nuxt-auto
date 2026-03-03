import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockEvent, createMockDb } from '../helpers/mocks'
import { aggregateHandler } from '../../src/runtime/server/handlers/aggregate'
import type { HandlerContext } from '../../src/types'

vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {}
}))

describe('Aggregations', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let mockTable: any

  beforeEach(() => {
    mockDb = createMockDb()
    mockTable = {
      id: { name: 'id' },
      title: { name: 'title' },
      userId: { name: 'userId' },
      published: { name: 'published' },
      views: { name: 'views' },
    }
  })

  describe('Simple Aggregations', () => {
    it('should count all records', async () => {
      mockDb.mockQueryResult([{ count: 10 }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'count' },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toHaveProperty('count')
    })

    it('should sum numeric field', async () => {
      mockDb.mockQueryResult([{ sum_views: 1500 }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=sum(views)'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'sum(views)' },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toHaveProperty('sum_views', 1500)
    })

    it('should calculate average', async () => {
      mockDb.mockQueryResult([{ avg_views: 150.5 }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=avg(views)'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'avg(views)' },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toHaveProperty('avg_views', 150.5)
    })

    it('should find minimum value', async () => {
      mockDb.mockQueryResult([{ min_views: 5 }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=min(views)'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'min(views)' },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toHaveProperty('min_views', 5)
    })

    it('should find maximum value', async () => {
      mockDb.mockQueryResult([{ max_views: 999 }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=max(views)'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'max(views)' },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toHaveProperty('max_views', 999)
    })

    it('should handle multiple aggregations', async () => {
      mockDb.mockQueryResult([{
        count: 10,
        sum_views: 1500,
        avg_views: 150,
        min_views: 5,
        max_views: 999,
      }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count,sum(views),avg(views),min(views),max(views)'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'count,sum(views),avg(views),min(views),max(views)' },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        count: 10,
        sum_views: 1500,
        avg_views: 150,
        min_views: 5,
        max_views: 999,
      })
    })
  })

  describe('GroupBy Aggregations', () => {
    it('should group by single field', async () => {
      mockDb.mockQueryResult([
        { published: true, count: 5 },
        { published: false, count: 3 },
      ])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count&groupBy=published'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: {
          aggregate: 'count',
          groupBy: 'published',
        },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(2)
      expect(result.meta.total).toBe(2)
    })

    it('should group by multiple fields', async () => {
      mockDb.mockQueryResult([
        { published: true, userId: 1, count: 3 },
        { published: true, userId: 2, count: 2 },
        { published: false, userId: 1, count: 1 },
      ])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count&groupBy=published,userId'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: {
          aggregate: 'count',
          groupBy: ['published', 'userId'],
        },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(3)
    })

    it('should handle aggregations with groupBy', async () => {
      mockDb.mockQueryResult([
        { userId: 1, count: 5, sum_views: 750 },
        { userId: 2, count: 3, sum_views: 450 },
      ])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count,sum(views)&groupBy=userId'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: {
          aggregate: 'count,sum(views)',
          groupBy: 'userId',
        },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(2)
      expect(result.data[0].group).toBeDefined()
    })
  })

  describe('Filtered Aggregations', () => {
    it('should apply filter to aggregation', async () => {
      mockDb.mockQueryResult([{ count: 5 }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count&filter={"published":true}'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: {
          aggregate: 'count',
          filter: { published: true },
        },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(mockDb.where).toHaveBeenCalled()
    })

    it('should apply filter with groupBy', async () => {
      mockDb.mockQueryResult([
        { userId: 1, count: 3 },
        { userId: 2, count: 2 },
      ])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count&groupBy=userId&filter={"published":true}'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: {
          aggregate: 'count',
          groupBy: 'userId',
          filter: { published: true },
        },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(2)
      expect(mockDb.where).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should require aggregate parameter', async () => {
      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: {},
      }

      await expect(aggregateHandler(context)).rejects.toThrow('aggregate parameter is required')
    })

    it('should reject invalid aggregate function', async () => {
      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=invalid'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'invalid' },
      }

      await expect(aggregateHandler(context)).rejects.toThrow('At least one aggregate function is required')
    })

    it('should reject sum without field', async () => {
      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=sum'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'sum' },
      }

      await expect(aggregateHandler(context)).rejects.toThrow('At least one aggregate function is required')
    })

    it('should reject avg without field', async () => {
      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=avg'),
        db: mockDb as any,
        schema: { posts: mockTable },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'avg' },
      }

      await expect(aggregateHandler(context)).rejects.toThrow('At least one aggregate function is required')
    })

    it('should handle non-existent resource', async () => {
      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/invalid/aggregate?aggregate=count'),
        db: mockDb as any,
        schema: {},
        resource: 'invalid',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'count' },
      }

      await expect(aggregateHandler(context)).rejects.toThrow('Table invalid not found in schema')
    })
  })

  describe('Tenant Scoping', () => {
    it('should apply tenant filter to aggregation', async () => {
      mockDb.mockQueryResult([{ count: 3 }])

      const context: HandlerContext = {
        event: createMockEvent('GET', '/api/posts/aggregate?aggregate=count'),
        db: mockDb as any,
        schema: { posts: { ...mockTable, organizationId: { name: 'organizationId' } } },
        resource: 'posts',
        operation: 'aggregate',
        permissions: [],
        query: { aggregate: 'count' },
        tenant: {
          field: 'organizationId',
          id: 'org-123',
          canAccessAllTenants: false,
        },
      }

      const result = await aggregateHandler(context)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].count).toBe(3)
    })
  })
})
