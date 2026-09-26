import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { encodeCursor, decodeCursor, buildCursorWhere, cursorOrder } from '../../../src/runtime/server/utils/cursor'
import { listHandler } from '../../../src/runtime/server/handlers/list'
import { makeContext } from '../../helpers/context'

vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, autoApi: {} }))

const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  group: text('grp').notNull(),
  rank: integer('rank').notNull(),
  at: integer('at', { mode: 'timestamp' }).notNull(),
})
const schema = { items }

describe('cursor encoding', () => {
  const order = cursorOrder([{ field: 'rank', direction: 'desc' }], items)

  it('appends the primary key as tiebreaker, in the first sort direction', () => {
    expect(order).toEqual([{ field: 'rank', direction: 'desc' }, { field: 'id', direction: 'desc' }])
    expect(cursorOrder([], items)).toEqual([{ field: 'id', direction: 'asc' }])
  })

  it('round-trips values, including dates', () => {
    const at = new Date('2024-01-15T10:30:00Z')
    const o = cursorOrder([{ field: 'at', direction: 'asc' }], items)
    expect(decodeCursor(encodeCursor({ id: 7, at }, o), o)).toEqual([at, 7])
  })

  it('rejects garbage, a wrong-length cursor, and NULL sort values', () => {
    expect(() => decodeCursor('not-base64-json', order)).toThrow(/Invalid cursor/)
    expect(() => decodeCursor(Buffer.from('[1]').toString('base64url'), order)).toThrow(/Invalid cursor/)
    expect(() => decodeCursor(Buffer.from('[null, 1]').toString('base64url'), order)).toThrow(/NOT NULL/)
    expect(() => decodeCursor(Buffer.from('[{"x":1}, 1]').toString('base64url'), order)).toThrow(/Invalid cursor/)
  })

  it('builds a lexicographic keyset condition', () => {
    expect(buildCursorWhere(items, encodeCursor({ rank: 3, id: 9 }, order), order)).toBeTruthy()
  })
})

describe('cursor pagination walks every row exactly once (real SQLite)', () => {
  let sqlite: Database.Database
  let db: any
  const all: Array<{ id: number, group: string, rank: number, at: Date }> = []

  beforeAll(() => {
    sqlite = new Database(':memory:')
    sqlite.exec('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, grp TEXT NOT NULL, rank INTEGER NOT NULL, at INTEGER NOT NULL)')
    db = drizzle(sqlite, { schema })
    // Heavy ties on rank and group — exactly what a first-column-only cursor gets wrong.
    for (let i = 0; i < 37; i++) {
      const row = { group: ['a', 'b', 'c'][i % 3]!, rank: i % 4, at: new Date(Date.UTC(2024, 0, 1 + (i % 5))) }
      const [inserted] = db.insert(items).values(row).returning().all()
      all.push(inserted)
    }
  })
  afterAll(() => sqlite.close())

  async function walk(sort: string | undefined, limit: number) {
    const seen: number[] = []
    let cursor = ''
    for (let page = 0; page < 100; page++) {
      const res = await listHandler(makeContext({ db, schema, resource: 'items', query: { cursor, limit, ...(sort ? { sort } : {}) } }))
      seen.push(...res.data.map((r: any) => r.id))
      if (!res.meta.hasMore) break
      expect(res.meta.nextCursor).toBeTruthy()
      cursor = res.meta.nextCursor!
    }
    return seen
  }

  const cmp = (specs: Array<[keyof typeof all[number], 1 | -1]>) => (a: any, b: any) => {
    for (const [k, d] of specs) {
      const x = a[k] instanceof Date ? a[k].getTime() : a[k]
      const y = b[k] instanceof Date ? b[k].getTime() : b[k]
      if (x < y) return -d
      if (x > y) return d
    }
    return 0
  }

  it.each([
    [undefined, [['id', 1]]],
    ['rank', [['rank', 1], ['id', 1]]],
    ['-rank', [['rank', -1], ['id', -1]]],
    ['group,-rank', [['group', 1], ['rank', -1], ['id', 1]]],
    ['-at,group', [['at', -1], ['group', 1], ['id', -1]]],
  ] as const)('sort=%s', async (sort, specs) => {
    for (const limit of [1, 4, 5, 36, 37, 100]) {
      const ids = await walk(sort, limit)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toEqual([...all].sort(cmp(specs as any)).map(r => r.id))
    }
  })
})
