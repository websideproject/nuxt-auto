import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { eq } from 'drizzle-orm'
import { aggregateHandler } from '../../src/runtime/server/handlers/aggregate'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { createAuthorizationMiddleware } from '../../src/runtime/server/middleware/authz'
import { makeContext } from '../helpers/context'

vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, autoApi: {} }))

const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  status: text('status').notNull(),
  total: integer('total').notNull(),
  secret: text('secret'),
  organizationId: text('organization_id'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})
const schema = { orders }

describe('Aggregations (real SQLite)', () => {
  let sqlite: Database.Database
  let db: any

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(`CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, total INTEGER NOT NULL,
      secret TEXT, organization_id TEXT, deleted_at INTEGER)`)
    db = drizzle(sqlite, { schema })
    db.insert(orders).values([
      { status: 'paid', total: 100, secret: 'a', organizationId: 'o1' },
      { status: 'paid', total: 300, secret: 'b', organizationId: 'o1' },
      { status: 'open', total: 50, secret: 'c', organizationId: 'o1' },
      { status: 'paid', total: 1000, secret: 'd', organizationId: 'o2' },
      { status: 'paid', total: 7, secret: 'e', organizationId: 'o1', deletedAt: new Date() },
    ]).run()
  })
  afterEach(() => sqlite.close())

  const ctx = (query: Record<string, any>, over: Parameters<typeof makeContext>[0] extends infer T ? Partial<T> : never = {}) =>
    makeContext({ db, schema, resource: 'orders', operation: 'aggregate', query, extra: { orders: { hiddenFields: ['secret'] } }, ...over })

  it('counts live rows only (soft-deleted rows are excluded)', async () => {
    const r = await aggregateHandler(ctx({ aggregate: 'count' }))
    expect(r.data).toEqual([{ count: 4 }])
  })

  it('computes sum / avg / min / max keyed <fn>_<field>', async () => {
    const r = await aggregateHandler(ctx({ aggregate: 'sum(total),avg(total),min(total),max(total)' }))
    expect(Number(r.data[0]!.sum_total)).toBe(1450)
    expect(Number(r.data[0]!.avg_total)).toBe(362.5)
    expect(r.data[0]!.min_total).toBe(50)
    expect(r.data[0]!.max_total).toBe(1000)
  })

  it('groups by a column and returns the group under `group`', async () => {
    const r = await aggregateHandler(ctx({ aggregate: 'count,sum(total)', groupBy: 'status' }))
    const byStatus = Object.fromEntries(r.data.map((row: any) => [row.group.status, row]))
    expect(byStatus.paid.count).toBe(3)
    expect(Number(byStatus.open.sum_total)).toBe(50)
  })

  it('applies `having` on aggregate aliases', async () => {
    const r = await aggregateHandler(ctx({ aggregate: 'count', groupBy: 'status', having: JSON.stringify({ count: { $gt: 1 } }) }))
    expect(r.data.map((row: any) => row.group.status)).toEqual(['paid'])
  })

  it('applies a JSON `filter` from the URL', async () => {
    const r = await aggregateHandler(ctx({ aggregate: 'sum(total)', filter: JSON.stringify({ status: 'paid' }) }))
    expect(Number(r.data[0]!.sum_total)).toBe(1400)
  })

  it('aggregates only the caller\'s tenant', async () => {
    const r = await aggregateHandler(ctx({ aggregate: 'sum(total)' }, {
      tenant: { id: 'o1', field: 'organizationId', canAccessAllTenants: false },
    }))
    expect(Number(r.data[0]!.sum_total)).toBe(450)
  })

  it('aggregates only rows the listFilter lets the caller see', async () => {
    const r = await aggregateHandler(ctx({ aggregate: 'count' }, {
      auth: { orders: { permissions: { read: true }, listFilter: t => eq(t.status, 'open') } },
    }))
    expect(r.data).toEqual([{ count: 1 }])
  })

  it.each([
    ['min(secret)', 'aggregate'],
    ['count(secret)', 'aggregate'],
  ])('refuses %s on a hidden field', async (aggregate) => {
    await expect(aggregateHandler(ctx({ aggregate }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuses groupBy on a hidden field', async () => {
    await expect(aggregateHandler(ctx({ aggregate: 'count', groupBy: 'secret' }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuses unknown functions, unknown fields and a missing field', async () => {
    await expect(aggregateHandler(ctx({ aggregate: 'median(total)' }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(aggregateHandler(ctx({ aggregate: 'sum(nope)' }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(aggregateHandler(ctx({ aggregate: 'sum' }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(aggregateHandler(ctx({}))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuses an unknown having alias or operator', async () => {
    await expect(aggregateHandler(ctx({ aggregate: 'count', groupBy: 'status', having: JSON.stringify({ nope: 1 }) }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(aggregateHandler(ctx({ aggregate: 'count', groupBy: 'status', having: JSON.stringify({ count: { $regex: 1 } }) }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('limits the number of groupBy fields (aggregations.maxGroupByFields)', async () => {
    await expect(aggregateHandler(ctx({ aggregate: 'count', groupBy: 'status,total' }, { autoApi: { aggregations: { maxGroupByFields: 1 } } })))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('is gated by `aggregate`, falling back to `read`', async () => {
    const authorize = (auth: any, user: any = { id: 1 }) => createAuthorizationMiddleware(auth)(ctx({ aggregate: 'count' }, { auth: { orders: auth }, user }))
    await expect(authorize({ permissions: { read: true } })).resolves.toBeUndefined()
    await expect(authorize({ permissions: { read: true, aggregate: false } })).rejects.toMatchObject({ statusCode: 403 })
    await expect(authorize({ permissions: { create: true } })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('list `?aggregate=` uses the same rows and refuses hidden fields', async () => {
    const list = await listHandler(makeContext({ db, schema, resource: 'orders', query: { aggregate: 'count,sum(total)' }, extra: { orders: { hiddenFields: ['secret'] } } }))
    expect(list.meta.aggregates).toMatchObject({ count: 4 })
    await expect(listHandler(makeContext({ db, schema, resource: 'orders', query: { aggregate: 'max(secret)' }, extra: { orders: { hiddenFields: ['secret'] } } })))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})
