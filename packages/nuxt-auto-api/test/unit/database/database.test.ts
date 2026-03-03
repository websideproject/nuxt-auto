import { describe, it, expect, beforeEach } from 'vitest'
import { initializeDatabase, getDatabaseAdapter } from '../../../src/runtime/server/database/index'

describe('Database initialization', () => {
  beforeEach(() => {
    // Reset global state
    globalThis.__autoApiDbAdapter = undefined
    ;(globalThis as any).__autoApiDb = undefined
  })

  describe('initializeDatabase', () => {
    it('should create an adapter and store it globally', () => {
      const mockDb = { transaction: () => {} }
      const adapter = initializeDatabase(mockDb, 'better-sqlite3')

      expect(adapter.engine).toBe('better-sqlite3')
      expect(adapter.db).toBe(mockDb)
      expect(globalThis.__autoApiDbAdapter).toBe(adapter)
    })

    it('should also set legacy __autoApiDb for backward compatibility', () => {
      const mockDb = { transaction: () => {} }
      initializeDatabase(mockDb, 'better-sqlite3')

      expect((globalThis as any).__autoApiDb).toBe(mockDb)
    })

    it('should support all engine types', () => {
      const engines = ['better-sqlite3', 'postgres', 'mysql', 'd1', 'turso', 'planetscale'] as const

      for (const engine of engines) {
        globalThis.__autoApiDbAdapter = undefined
        const adapter = initializeDatabase({}, engine)
        expect(adapter.engine).toBe(engine)
      }
    })
  })

  describe('getDatabaseAdapter', () => {
    it('should return the initialized adapter', () => {
      const mockDb = { transaction: () => {} }
      const adapter = initializeDatabase(mockDb, 'postgres')

      expect(getDatabaseAdapter()).toBe(adapter)
    })

    it('should fall back to legacy __autoApiDb', () => {
      const mockDb = { transaction: () => {} }
      ;(globalThis as any).__autoApiDb = mockDb

      const adapter = getDatabaseAdapter()
      expect(adapter.engine).toBe('better-sqlite3') // default fallback
      expect(adapter.db).toBe(mockDb)
    })

    it('should throw when no database is initialized', () => {
      expect(() => getDatabaseAdapter()).toThrow('Database not initialized')
    })

    it('should cache the adapter after legacy fallback', () => {
      const mockDb = { transaction: () => {} }
      ;(globalThis as any).__autoApiDb = mockDb

      const adapter1 = getDatabaseAdapter()
      const adapter2 = getDatabaseAdapter()
      expect(adapter1).toBe(adapter2)
    })
  })
})
