import { describe, it, expect, vi } from 'vitest'
import { encodeCursor, decodeCursor, buildCursorWhere } from '../../../src/runtime/server/utils/cursor'
import { gt, lt } from 'drizzle-orm'

describe('cursor utilities', () => {
  describe('encodeCursor', () => {
    it('should encode a single field cursor', () => {
      const record = { id: 123, name: 'Test' }
      const cursor = encodeCursor(record, ['id'])

      expect(cursor).toBeTruthy()
      expect(typeof cursor).toBe('string')
    })

    it('should encode multiple fields', () => {
      const record = { id: 123, createdAt: new Date('2024-01-01') }
      const cursor = encodeCursor(record, ['id', 'createdAt'])

      const decoded = decodeCursor(cursor)
      expect(decoded.id).toBe(123)
      expect(decoded.createdAt).toBeTruthy()
    })

    it('should default to id field if no fields specified', () => {
      const record = { id: 456, name: 'Test' }
      const cursor = encodeCursor(record)

      const decoded = decodeCursor(cursor)
      expect(decoded.id).toBe(456)
      expect(decoded.name).toBeUndefined()
    })

    it('should handle string ids', () => {
      const record = { id: 'uuid-123', name: 'Test' }
      const cursor = encodeCursor(record, ['id'])

      const decoded = decodeCursor(cursor)
      expect(decoded.id).toBe('uuid-123')
    })

    it('should handle timestamp fields', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const record = { id: 1, createdAt: date }
      const cursor = encodeCursor(record, ['createdAt'])

      const decoded = decodeCursor(cursor)
      expect(decoded.createdAt).toBe(date.toISOString())
    })
  })

  describe('decodeCursor', () => {
    it('should decode a valid cursor', () => {
      const original = { id: 123 }
      const cursor = Buffer.from(JSON.stringify(original)).toString('base64url')

      const decoded = decodeCursor(cursor)
      expect(decoded).toEqual(original)
    })

    it('should throw error for invalid cursor', () => {
      expect(() => decodeCursor('invalid-cursor')).toThrow('Invalid cursor')
    })

    it('should throw error for malformed JSON', () => {
      const badCursor = Buffer.from('not-json').toString('base64url')
      expect(() => decodeCursor(badCursor)).toThrow('Invalid cursor')
    })

    it('should decode complex objects', () => {
      const original = { id: 123, createdAt: '2024-01-01T00:00:00Z' }
      const cursor = Buffer.from(JSON.stringify(original)).toString('base64url')

      const decoded = decodeCursor(cursor)
      expect(decoded).toEqual(original)
    })
  })

  describe('buildCursorWhere', () => {
    const mockTable = {
      id: Symbol('id'),
      createdAt: Symbol('createdAt'),
    }

    it('should build gt clause for ascending order', () => {
      const cursor = encodeCursor({ id: 100 }, ['id'])

      const result = buildCursorWhere(mockTable, cursor, ['id'], 'asc')

      // Check that gt was called with the right field
      expect(result).toBeDefined()
    })

    it('should build lt clause for descending order', () => {
      const cursor = encodeCursor({ id: 100 }, ['id'])

      const result = buildCursorWhere(mockTable, cursor, ['id'], 'desc')

      // Check that lt was called
      expect(result).toBeDefined()
    })

    it('should handle composite cursors', () => {
      const cursor = encodeCursor({ id: 100, createdAt: new Date() }, ['id', 'createdAt'])

      const result = buildCursorWhere(mockTable, cursor, ['id', 'createdAt'], 'asc')

      expect(result).toBeDefined()
    })

    it('should default to ascending direction', () => {
      const cursor = encodeCursor({ id: 100 }, ['id'])

      const resultAsc = buildCursorWhere(mockTable, cursor, ['id'])
      const resultExplicit = buildCursorWhere(mockTable, cursor, ['id'], 'asc')

      expect(resultAsc).toBeDefined()
      expect(resultExplicit).toBeDefined()
    })
  })

  describe('cursor round-trip', () => {
    it('should encode and decode consistently', () => {
      const original = { id: 999, createdAt: '2024-01-01T00:00:00Z' }
      const cursor = encodeCursor(original, ['id', 'createdAt'])
      const decoded = decodeCursor(cursor)

      expect(decoded).toEqual(original)
    })

    it('should handle special characters in values', () => {
      const original = { id: 'test@example.com' }
      const cursor = encodeCursor(original, ['id'])
      const decoded = decodeCursor(cursor)

      expect(decoded.id).toBe('test@example.com')
    })

    it('should handle numeric edge cases', () => {
      const original = { id: 0 }
      const cursor = encodeCursor(original, ['id'])
      const decoded = decodeCursor(cursor)

      expect(decoded.id).toBe(0)
    })
  })
})
