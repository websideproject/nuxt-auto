import { describe, it, expect } from 'vitest'
import { sqliteTable, integer, text, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { buildWhereClause, parseFilterParam } from '../../../src/runtime/server/utils/buildWhereClause'

const dialect = new SQLiteSyncDialect()

const testTable = sqliteTable('test', {
  id: integer('id').primaryKey(),
  name: text('name'),
  age: integer('age'),
  status: text('status'),
})

const eventTable = sqliteTable('events', {
  id: integer('id').primaryKey(),
  title: text('title'),
  at: integer('at', { mode: 'timestamp' }),
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
      age: { $gt: 18 },
    }
    const result = buildWhereClause(filter, testTable)

    expect(result).toBeDefined()
  })

  it('should return undefined for empty filter', () => {
    const result = buildWhereClause({}, testTable)
    expect(result).toBeUndefined()
  })

  it('rejects a field that is not a column (400) — a dropped condition would widen the result', () => {
    expect(() => buildWhereClause({ nonexistent: 'value' }, testTable)).toThrow(/Unknown field 'nonexistent'/)
    expect(() => buildWhereClause({ name: 'John', nonexistent: 'value' }, testTable)).toThrow(/Unknown field/)
  })

  it('rejects table internals that are not columns', () => {
    expect(() => buildWhereClause({ _: 1 } as any, testTable)).toThrow(/Unknown field '_'/)
    expect(() => buildWhereClause({ getSQL: 1 } as any, testTable)).toThrow(/Unknown field/)
  })

  it('rejects a field outside the allowed set (hidden / unreadable) with the same message', () => {
    expect(() => buildWhereClause({ age: 3 }, testTable, new Set(['name']))).toThrow(/Unknown field 'age'/)
  })

  it('rejects unknown operators', () => {
    expect(() => buildWhereClause({ name: { $regex: 'x' } }, testTable)).toThrow(/Unknown filter operator '\$regex'/)
    expect(() => buildWhereClause({ name: {} }, testTable)).toThrow(/no operator/)
  })

  it('bounds $in / $nin lists', () => {
    expect(() => buildWhereClause({ id: { $in: [] } }, testTable)).toThrow(/at least one/)
    expect(() => buildWhereClause({ id: { $in: Array.from({ length: 501 }, (_, i) => i) } }, testTable)).toThrow(/at most/)
  })

  it('renders the expected SQL', () => {
    const r = (f: any) => dialect.sqlToQuery(buildWhereClause(f, testTable)!)
    expect(r({ name: 'John' })).toMatchObject({ sql: '"test"."name" = ?', params: ['John'] })
    expect(r({ name: null })).toMatchObject({ sql: '"test"."name" is null', params: [] })
    expect(r({ status: ['a', 'b'] })).toMatchObject({ sql: '"test"."status" in (?, ?)', params: ['a', 'b'] })
    expect(r({ age: { $gte: 18, $lt: 65 } })).toMatchObject({ sql: '("test"."age" >= ? and "test"."age" < ?)', params: [18, 65] })
    expect(r({ status: { $nin: 'x,y' } })).toMatchObject({ sql: '"test"."status" not in (?, ?)', params: ['x', 'y'] })
    expect(r({ name: { $like: 'oh' } })).toMatchObject({ sql: '"test"."name" like ?', params: ['%oh%'] })
  })

  it('returns undefined for an absent filter and rejects a non-object', () => {
    expect(buildWhereClause(null as any, testTable)).toBeUndefined()
    expect(buildWhereClause(undefined, testTable)).toBeUndefined()
    expect(() => buildWhereClause('invalid' as any, testTable)).toThrow(/JSON object/)
    expect(() => buildWhereClause([] as any, testTable)).toThrow(/JSON object/)
  })

  it('$or: any of several filters, each checked like a top-level filter', () => {
    const r = (f: any, allowed?: Set<string>) => dialect.sqlToQuery(buildWhereClause(f, testTable, allowed)!)
    expect(r({ $or: [{ name: { $like: 'jo' } }, { status: { $like: 'jo' } }] })).toMatchObject({
      sql: '("test"."name" like ? or "test"."status" like ?)',
      params: ['%jo%', '%jo%'],
    })
    // ANDed with the rest of the filter
    expect(r({ age: { $gt: 1 }, $or: [{ name: 'a' }, { name: 'b' }] })).toMatchObject({
      sql: '("test"."age" > ? and ("test"."name" = ? or "test"."name" = ?))',
      params: [1, 'a', 'b'],
    })
    expect(r({ $or: [{ name: 'a' }] })).toMatchObject({ sql: '"test"."name" = ?' })
    // a hidden / unreadable field inside a branch is the same 400 as at the top level
    expect(() => r({ $or: [{ name: 'a' }, { age: 3 }] }, new Set(['name']))).toThrow(/Unknown field 'age'/)
  })

  it('$or rejects malformed, empty, nested and oversized forms', () => {
    expect(() => buildWhereClause({ $or: {} } as any, testTable)).toThrow(/non-empty array/)
    expect(() => buildWhereClause({ $or: [] }, testTable)).toThrow(/non-empty array/)
    expect(() => buildWhereClause({ $or: ['x'] }, testTable)).toThrow(/JSON objects/)
    expect(() => buildWhereClause({ $or: [{}] }, testTable)).toThrow(/cannot be empty/)
    expect(() => buildWhereClause({ $or: [{ $or: [{ name: 'a' }] }] }, testTable)).toThrow(/cannot be nested/)
    expect(() => buildWhereClause({ $or: Array.from({ length: 21 }, () => ({ name: 'a' })) }, testTable)).toThrow(/at most 20/)
  })

  it('takes ISO strings and epoch milliseconds on a timestamp column (they used to crash the query)', () => {
    const r = (f: any) => dialect.sqlToQuery(buildWhereClause(f, eventTable)!)
    const seconds = Date.UTC(2026, 0, 1) / 1000
    expect(r({ at: { $gte: '2026-01-01T00:00:00.000Z' } })).toMatchObject({ sql: '"events"."at" >= ?', params: [seconds] })
    expect(r({ at: { $lt: Date.UTC(2026, 0, 1) } })).toMatchObject({ params: [seconds] })
    expect(r({ at: '2026-01-01T00:00:00.000Z' })).toMatchObject({ params: [seconds] })
    expect(r({ at: { $in: ['2026-01-01T00:00:00.000Z'] } })).toMatchObject({ params: [seconds] })
    expect(r({ at: { $null: true } })).toMatchObject({ sql: '"events"."at" is null' })
    expect(() => buildWhereClause({ at: { $gte: 'not a date' } }, eventTable)).toThrow(/needs a date/)
    expect(() => buildWhereClause({ at: { $gte: true } }, eventTable)).toThrow(/needs a date/)
    expect(() => buildWhereClause({ at: { $like: '2026' } }, eventTable)).toThrow(/needs a text column/)
  })

  it('parseFilterParam parses URL JSON and rejects malformed JSON', () => {
    expect(parseFilterParam('{"a":1}')).toEqual({ a: 1 })
    expect(parseFilterParam(undefined)).toBeUndefined()
    expect(() => parseFilterParam('{nope')).toThrow(/not valid JSON/)
  })
})
