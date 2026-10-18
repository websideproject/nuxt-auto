import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { purgeExpiredTrash } from '../../../src/runtime/server/utils/softDeleteRetention'
import { resetRegistry, setRegistry } from '../../helpers/registry-stub'

const notes = sqliteTable('notes', { id: integer('id').primaryKey(), body: text('body'), deletedAt: integer('deleted_at', { mode: 'timestamp' }) })
const drafts = sqliteTable('drafts', { id: integer('id').primaryKey(), deletedAt: integer('deleted_at', { mode: 'timestamp' }) })
const tags = sqliteTable('tags', { id: integer('id').primaryKey(), name: text('name') })

const now = new Date('2026-10-18T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
let db: any

beforeEach(async () => {
  const sqlite = new Database(':memory:')
  sqlite.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT, deleted_at INTEGER); CREATE TABLE drafts (id INTEGER PRIMARY KEY, deleted_at INTEGER); CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)')
  db = drizzle(sqlite)
  await db.insert(notes).values([
    { id: 1, body: 'live' },
    { id: 2, body: 'trashed recently', deletedAt: daysAgo(5) },
    { id: 3, body: 'trashed long ago', deletedAt: daysAgo(40) },
  ])
  await db.insert(drafts).values([{ id: 1, deletedAt: daysAgo(400) }])
  setRegistry({
    notes: { name: 'notes', schema: notes, authorization: { softDelete: { retentionDays: 30 } } },
    drafts: { name: 'drafts', schema: drafts, authorization: {} },
    tags: { name: 'tags', schema: tags, authorization: { softDelete: { retentionDays: 1 } } },
  })
})
afterEach(() => resetRegistry())

describe('purgeExpiredTrash', () => {
  it('hard-deletes trash older than the resource retention, and nothing else', async () => {
    expect(await purgeExpiredTrash({ db, now })).toEqual({ purged: { notes: 1 }, total: 1, errors: {} })
    expect((await db.select().from(notes)).map((r: any) => r.id)).toEqual([1, 2])
    // No retention: kept forever
    expect(await db.select().from(drafts)).toHaveLength(1)
  })

  it('reads a retention set in nuxt.config', async () => {
    const runtimeConfig = { autoApi: { authorization: { drafts: { softDelete: { retentionDays: 365 } }, notes: { softDelete: { retentionDays: 0 } } } } }
    expect(await purgeExpiredTrash({ db, now, runtimeConfig })).toEqual({ purged: { drafts: 1 }, total: 1, errors: {} })
    expect(await db.select().from(notes)).toHaveLength(3)
  })

  it('reports a resource whose purge fails and goes on', async () => {
    const broken = {
      select: () => {
        throw new Error('boom')
      },
    }
    expect(await purgeExpiredTrash({ db: broken, now })).toEqual({ purged: {}, total: 0, errors: { notes: 'boom' } })
  })
})
