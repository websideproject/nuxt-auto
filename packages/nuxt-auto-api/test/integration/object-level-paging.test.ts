import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { makeContext } from '../helpers/context'

vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, autoApi: {} }))

const items = sqliteTable('items', { id: integer('id').primaryKey(), name: text('name') })
let sqlite: any
let db: any

beforeEach(async () => {
  sqlite = new Database(':memory:')
  sqlite.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)')
  db = drizzle(sqlite)
  await db.insert(items).values(Array.from({ length: 300 }, (_, i) => ({ id: i + 1, name: `item ${i + 1}` })))
})
afterEach(() => sqlite.close())

// objectLevel keeps one row in fifty — far past what the first batches hold.
const list = (query: Record<string, any>) => listHandler(makeContext({
  db,
  schema: { items },
  resource: 'items',
  operation: 'list',
  query: { sort: 'id', ...query },
  auth: { items: { permissions: { read: true }, objectLevel: (row: any) => row.id % 50 === 0 } },
}))

describe('objectLevel paging', () => {
  it('fills the page however many rows the check drops', async () => {
    const page: any = await list({ limit: 2, page: 1 })
    expect(page.data.map((r: any) => r.id)).toEqual([50, 100])
    expect(page.meta.hasMore).toBe(true)
  })

  it('reaches later pages and the end', async () => {
    const third: any = await list({ limit: 2, page: 3 })
    expect(third.data.map((r: any) => r.id)).toEqual([250, 300])
    expect(third.meta.hasMore).toBe(false)
  })
})
