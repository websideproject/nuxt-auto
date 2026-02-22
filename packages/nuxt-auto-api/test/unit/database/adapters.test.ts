import { describe, it, expect, vi } from 'vitest'
import { createAdapter } from '../../../src/runtime/server/database/adapters/factory'
import { createSqliteAdapter } from '../../../src/runtime/server/database/adapters/sqlite'
import { createPostgresAdapter } from '../../../src/runtime/server/database/adapters/postgres'
import { createMysqlAdapter } from '../../../src/runtime/server/database/adapters/mysql'
import { createD1Adapter } from '../../../src/runtime/server/database/adapters/d1'
import { createTursoAdapter } from '../../../src/runtime/server/database/adapters/turso'
import { createPlanetscaleAdapter } from '../../../src/runtime/server/database/adapters/planetscale'

describe('Database Adapters', () => {
  describe('createAdapter factory', () => {
    const mockDb = { transaction: vi.fn(), batch: vi.fn() }

    it('should create sqlite adapter', () => {
      const adapter = createAdapter(mockDb, 'better-sqlite3')
      expect(adapter.engine).toBe('better-sqlite3')
      expect(adapter.db).toBe(mockDb)
    })

    it('should create postgres adapter', () => {
      const adapter = createAdapter(mockDb, 'postgres')
      expect(adapter.engine).toBe('postgres')
    })

    it('should create mysql adapter', () => {
      const adapter = createAdapter(mockDb, 'mysql')
      expect(adapter.engine).toBe('mysql')
    })

    it('should create d1 adapter', () => {
      const adapter = createAdapter(mockDb, 'd1')
      expect(adapter.engine).toBe('d1')
    })

    it('should create turso adapter', () => {
      const adapter = createAdapter(mockDb, 'turso')
      expect(adapter.engine).toBe('turso')
    })

    it('should create planetscale adapter', () => {
      const adapter = createAdapter(mockDb, 'planetscale')
      expect(adapter.engine).toBe('planetscale')
    })

    it('should throw for unsupported engine', () => {
      expect(() => createAdapter(mockDb, 'unknown' as any)).toThrow('Unsupported database engine')
    })
  })

  describe('SQLite adapter', () => {
    it('should have correct properties', () => {
      const mockDb = { transaction: vi.fn() }
      const adapter = createSqliteAdapter(mockDb)

      expect(adapter.engine).toBe('better-sqlite3')
      expect(adapter.supportsReturning).toBe(true)
      expect(adapter.supportsNativeBatch).toBe(false)
    })

    it('should call db.transaction in atomic()', async () => {
      const mockTx = { insert: vi.fn() }
      const mockDb = {
        transaction: vi.fn((fn: any) => fn(mockTx)),
      }
      const adapter = createSqliteAdapter(mockDb)

      const result = await adapter.atomic(async ({ tx }) => {
        return 'done'
      })

      expect(mockDb.transaction).toHaveBeenCalled()
      expect(result).toBe('done')
    })

    it('should parse mutation count from changes', () => {
      const adapter = createSqliteAdapter({})
      expect(adapter.getMutationCount({ changes: 5 })).toBe(5)
      expect(adapter.getMutationCount({})).toBe(0)
      expect(adapter.getMutationCount(null)).toBe(0)
    })
  })

  describe('Postgres adapter', () => {
    it('should have correct properties', () => {
      const adapter = createPostgresAdapter({})
      expect(adapter.engine).toBe('postgres')
      expect(adapter.supportsReturning).toBe(true)
      expect(adapter.supportsNativeBatch).toBe(false)
    })

    it('should parse mutation count from array length', () => {
      const adapter = createPostgresAdapter({})
      expect(adapter.getMutationCount([{}, {}, {}])).toBe(3)
    })

    it('should parse mutation count from rowCount', () => {
      const adapter = createPostgresAdapter({})
      expect(adapter.getMutationCount({ rowCount: 7 })).toBe(7)
    })
  })

  describe('MySQL adapter', () => {
    it('should have correct properties', () => {
      const adapter = createMysqlAdapter({})
      expect(adapter.engine).toBe('mysql')
      expect(adapter.supportsReturning).toBe(false)
      expect(adapter.supportsNativeBatch).toBe(false)
    })

    it('should parse mutation count from affectedRows', () => {
      const adapter = createMysqlAdapter({})
      expect(adapter.getMutationCount([{ affectedRows: 3 }])).toBe(3)
    })
  })

  describe('D1 adapter', () => {
    it('should have correct properties', () => {
      const adapter = createD1Adapter({})
      expect(adapter.engine).toBe('d1')
      expect(adapter.supportsReturning).toBe(true)
      expect(adapter.supportsNativeBatch).toBe(true)
    })

    it('should pass db as tx in atomic()', async () => {
      const mockDb = { batch: vi.fn() }
      const adapter = createD1Adapter(mockDb)

      let receivedTx: any
      await adapter.atomic(async ({ tx }) => {
        receivedTx = tx
      })

      expect(receivedTx).toBe(mockDb)
    })

    it('should parse mutation count from meta.changes', () => {
      const adapter = createD1Adapter({})
      expect(adapter.getMutationCount({ meta: { changes: 4 } })).toBe(4)
    })

    it('should parse mutation count from array length', () => {
      const adapter = createD1Adapter({})
      expect(adapter.getMutationCount([{}, {}])).toBe(2)
    })
  })

  describe('Turso adapter', () => {
    it('should have correct properties', () => {
      const adapter = createTursoAdapter({})
      expect(adapter.engine).toBe('turso')
      expect(adapter.supportsReturning).toBe(true)
      expect(adapter.supportsNativeBatch).toBe(true)
    })

    it('should parse mutation count from rowsAffected', () => {
      const adapter = createTursoAdapter({})
      expect(adapter.getMutationCount({ rowsAffected: 6 })).toBe(6)
    })
  })

  describe('PlanetScale adapter', () => {
    it('should have correct properties', () => {
      const adapter = createPlanetscaleAdapter({})
      expect(adapter.engine).toBe('planetscale')
      expect(adapter.supportsReturning).toBe(false)
      expect(adapter.supportsNativeBatch).toBe(false)
    })
  })
})
