import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { eq, and } from 'drizzle-orm'
import { createRevisionPlugin } from '../../../src/runtime/plugins/revisionPlugin'

// Self-contained fixture: a tracked `articles` table + the `revisions` store.
const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  secret: text('secret'),
})
const revisions = sqliteTable('revisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  resource: text('resource').notNull(),
  recordId: text('record_id').notNull(),
  version: integer('version').notNull(),
  operation: text('operation').notNull(),
  data: text('data', { mode: 'json' }),
  userId: text('user_id'),
  organizationId: text('organization_id'),
  authMethod: text('auth_method'),
  reason: text('reason'),
})
const schema = { articles, revisions }

/** Drive runtimeSetup, capturing the global hook object so tests can fire individual hooks. */
function wire(opts: any = {}) {
  const hooks: any[] = []
  const ctx = {
    addGlobalHook: (h: any) => hooks.push(h),
    logger: { info: vi.fn() },
  }
  const plugin = createRevisionPlugin(opts)
  ;(plugin as any).runtimeSetup(ctx)
  const fire = async (name: string, ...args: any[]) => {
    for (const h of hooks) if (h[name]) await h[name](...args)
  }
  return { fire }
}

describe('createRevisionPlugin', () => {
  let db: any
  let sqlite: any

  beforeEach(() => {
    sqlite = new Database(':memory:')
    db = drizzle(sqlite, { schema })
    sqlite.exec(`
      CREATE TABLE articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, secret TEXT);
      CREATE TABLE revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, resource TEXT NOT NULL, record_id TEXT NOT NULL,
        version INTEGER NOT NULL, operation TEXT NOT NULL, data TEXT, user_id TEXT, organization_id TEXT,
        auth_method TEXT, reason TEXT);
    `)
  })
  afterEach(() => sqlite.close())

  function mkCtx(extra: any = {}) {
    return { db, schema, resource: 'articles', user: { id: 7, organizationId: 'org-1' }, ...extra }
  }

  it('records a create snapshot (version 1) with author + org', async () => {
    const { fire } = wire()
    await fire('afterCreate', { id: 1, title: 'A', secret: 's' }, mkCtx())

    const [rev] = await db.select().from(revisions).where(eq(revisions.recordId, '1'))
    expect(rev.operation).toBe('create')
    expect(rev.version).toBe(1)
    expect(rev.userId).toBe('7')
    expect(rev.organizationId).toBe('org-1')
    expect(rev.data.title).toBe('A')
  })

  it('increments version across create + update of the same record', async () => {
    const { fire } = wire()
    await fire('afterCreate', { id: 1, title: 'A' }, mkCtx())
    await fire('afterUpdate', { id: 1, title: 'B' }, mkCtx())

    const rows = await db.select().from(revisions).where(eq(revisions.recordId, '1'))
    expect(rows.map((r: any) => r.version).sort()).toEqual([1, 2])
    expect(rows.find((r: any) => r.version === 2).operation).toBe('update')
  })

  it('captures a delete snapshot via beforeDelete (stash) + afterDelete (record)', async () => {
    await db.insert(articles).values({ id: 5, title: 'Doomed', secret: 'x' })
    const { fire } = wire()
    const ctx = mkCtx()
    await fire('beforeDelete', 5, ctx)
    await fire('afterDelete', 5, ctx)

    const [rev] = await db.select().from(revisions).where(eq(revisions.recordId, '5'))
    expect(rev.operation).toBe('delete')
    expect(rev.data.title).toBe('Doomed')
  })

  it('honours _revOperation override (soft-delete label) + _revReason', async () => {
    await db.insert(articles).values({ id: 9, title: 'Trash me' })
    const { fire } = wire()
    const ctx = mkCtx({ _revOperation: 'soft-delete', _revReason: 'spam' })
    await fire('beforeDelete', 9, ctx)
    await fire('afterDelete', 9, ctx)

    const [rev] = await db.select().from(revisions).where(eq(revisions.recordId, '9'))
    expect(rev.operation).toBe('soft-delete')
    expect(rev.reason).toBe('spam')
  })

  it('strips excluded fields from the snapshot', async () => {
    const { fire } = wire({ excludeFields: ['secret'] })
    await fire('afterCreate', { id: 1, title: 'A', secret: 'TOP' }, mkCtx())
    const [rev] = await db.select().from(revisions).where(eq(revisions.recordId, '1'))
    expect(rev.data.title).toBe('A')
    expect('secret' in rev.data).toBe(false)
  })

  it('does not track resources outside the allow-list', async () => {
    const { fire } = wire({ resources: ['other'] })
    await fire('afterCreate', { id: 1, title: 'A' }, mkCtx())
    expect((await db.select().from(revisions)).length).toBe(0)
  })

  it('prunes to maxRevisionsPerRecord', async () => {
    const { fire } = wire({ maxRevisionsPerRecord: 3 })
    for (let i = 0; i < 5; i++) await fire('afterUpdate', { id: 1, title: `v${i}` }, mkCtx())
    const rows = await db.select().from(revisions).where(eq(revisions.recordId, '1'))
    expect(rows.length).toBe(3)
    // The newest (highest version) are kept.
    expect(Math.max(...rows.map((r: any) => r.version))).toBe(5)
  })
})
