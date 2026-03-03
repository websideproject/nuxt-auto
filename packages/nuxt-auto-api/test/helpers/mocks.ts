import { vi } from 'vitest'
import type { H3Event } from 'h3'
import type { HandlerContext } from '../../src/runtime/types'

/**
 * Create mock H3 event
 */
export function createMockH3Event(overrides: any = {}): Partial<H3Event> {
  return {
    path: '/api/posts',
    method: 'GET',
    context: {
      user: null,
      ...overrides.context
    },
    node: {
      req: {
        headers: {},
        url: '/api/posts'
      },
      res: {}
    } as any,
    ...overrides
  } as any
}

export const createMockEvent = createMockH3Event

/**
 * Create mock handler context
 */
export function createMockContext(overrides: any = {}): Partial<HandlerContext> {
  const defaultEvent = createMockH3Event()
  
  const event = overrides.event 
    ? { ...defaultEvent, ...overrides.event, node: { ...defaultEvent.node, ...(overrides.event.node || {}) } }
    : defaultEvent

  const db = overrides.db || null as any;
  const adapter = overrides.adapter || (db ? {
    atomic: async (cb: any) => {
      if (db.transaction) return db.transaction((tx: any) => cb({ tx }));
      return cb({ tx: db });
    }
  } : null as any);

  return {
    db,
    adapter,
    schema: {} as any,
    user: null,
    permissions: [],
    params: {},
    query: {},
    validated: {},
    resource: 'posts',
    operation: 'list',
    ...overrides,
    event // Use the merged event
  }
}

/**
 * Create mock user with permissions
 */
export function createMockUser(role = 'user', overrides: any = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    role,
    permissions: getRolePermissions(role),
    ...overrides
  }
}

function getRolePermissions(role: string): string[] {
  const permissionsMap: Record<string, string[]> = {
    admin: ['read', 'create', 'update', 'delete', 'admin'],
    editor: ['read', 'create', 'update', 'editor'],
    user: ['read', 'create', 'user']
  }
  return permissionsMap[role] || ['read']
}

/**
 * Mock database with spy functions
 */
export function createMockDb() {
  const mockResult: any[] = []
  
  const mockQuery = {
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve(mockResult))
  }

  const db = {
    query: {
      posts: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      users: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      }
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn()
        }))
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn()
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => mockQuery)
    })),
    mockQueryResult: (result: any[]) => {
      mockResult.splice(0, mockResult.length, ...result)
    },
    where: mockQuery.where
  }

  return db
}
