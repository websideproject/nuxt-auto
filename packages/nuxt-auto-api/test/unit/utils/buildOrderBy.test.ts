import { describe, it, expect } from 'vitest'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { buildOrderBy, parseSort } from '../../../src/runtime/server/utils/buildOrderBy'

const testTable = sqliteTable('test', {
  id: integer('id').primaryKey(),
  name: text('name'),
  createdAt: integer('created_at'),
})

describe('buildOrderBy', () => {
  it('should sort ascending by default', () => {
    const result = buildOrderBy('name', testTable)

    expect(result).toBeDefined()
    expect(result).toHaveLength(1)
  })

  it('should sort descending with - prefix', () => {
    const result = buildOrderBy('-createdAt', testTable)

    expect(result).toBeDefined()
    expect(result).toHaveLength(1)
  })

  it('should handle array of sort fields', () => {
    const result = buildOrderBy(['name', '-createdAt'], testTable)

    expect(result).toHaveLength(2)
  })

  it('rejects a field that is not a column (400)', () => {
    expect(() => buildOrderBy('nonexistent', testTable)).toThrow(/Unknown field 'nonexistent' in sort/)
    expect(() => buildOrderBy(['name', 'nonexistent'], testTable)).toThrow(/Unknown field/)
  })

  it('rejects a field outside the allowed set (hidden / unreadable)', () => {
    expect(() => buildOrderBy('name', testTable, new Set(['id']))).toThrow(/Unknown field 'name'/)
  })

  it('accepts a comma-separated list and drops duplicates', () => {
    expect(parseSort('name,-createdAt,name', testTable)).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'createdAt', direction: 'desc' },
    ])
  })

  it('should return empty array for undefined sort', () => {
    const result = buildOrderBy(undefined, testTable)

    expect(result).toEqual([])
  })

  it('should return empty array for null sort', () => {
    const result = buildOrderBy(null as any, testTable)

    expect(result).toEqual([])
  })

  it('should handle empty string', () => {
    const result = buildOrderBy('', testTable)

    expect(result).toEqual([])
  })

  it('should handle empty array', () => {
    const result = buildOrderBy([], testTable)

    expect(result).toEqual([])
  })
})
