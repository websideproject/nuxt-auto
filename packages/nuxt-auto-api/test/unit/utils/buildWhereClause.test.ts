import { describe, it, expect } from 'vitest'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { buildWhereClause } from '../../../src/runtime/server/utils/buildWhereClause'

const testTable = sqliteTable('test', {
  id: integer('id').primaryKey(),
  name: text('name'),
  age: integer('age'),
  status: text('status')
})

describe('buildWhereClause', () => {
  it('should build simple equality filter', () => {
    const filter = { name: 'John' }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $eq operator', () => {
    const filter = { name: { $eq: 'John' } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $ne operator', () => {
    const filter = { name: { $ne: 'John' } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $gt operator', () => {
    const filter = { age: { $gt: 18 } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $gte operator', () => {
    const filter = { age: { $gte: 18 } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $lt operator', () => {
    const filter = { age: { $lt: 65 } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $lte operator', () => {
    const filter = { age: { $lte: 65 } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $in operator with array', () => {
    const filter = { status: { $in: ['active', 'pending'] } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $in operator with string', () => {
    const filter = { status: { $in: 'active,pending' } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $like operator', () => {
    const filter = { name: { $like: 'John' } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $null operator with true', () => {
    const filter = { name: { $null: true } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle $null operator with false', () => {
    const filter = { name: { $null: false } }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should handle multiple filters with AND', () => {
    const filter = {
      status: 'active',
      age: { $gt: 18 }
    }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should return undefined for empty filter', () => {
    const result = buildWhereClause({}, testTable)
    expect(result).toBeUndefined()
  })

  it('should ignore invalid column names', () => {
    const filter = { nonexistent: 'value' }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeUndefined()
  })

  it('should handle mixed valid and invalid fields', () => {
    const filter = {
      name: 'John',
      nonexistent: 'value'
    }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should return undefined for null filter', () => {
    const result = buildWhereClause(null as any, testTable)
    expect(result).toBeUndefined()
  })

  it('should return undefined for non-object filter', () => {
    const result = buildWhereClause('invalid' as any, testTable)
    expect(result).toBeUndefined()
  })
})
