import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { conflictFromUniqueViolation, uniqueViolationColumns } from '../../../src/runtime/server/utils/uniqueViolation'

const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: text('org_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
}, t => [uniqueIndex('articles_org_slug').on(t.orgId, t.slug)])

const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

function setup() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE articles (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL);
    CREATE UNIQUE INDEX articles_org_slug ON articles (org_id, slug);
    CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
  `)
  return drizzle(sqlite)
}

async function caught(fn: () => Promise<unknown>) {
  try {
    await fn()
  }
  catch (error) {
    return error
  }
  throw new Error('expected the write to fail')
}

describe('unique violations', () => {
  it('a duplicate value through drizzle + SQLite becomes a 409 naming the field by its property key', async () => {
    const db = setup()
    await db.insert(tags).values({ name: 'news' })
    const error = await caught(() => db.insert(tags).values({ name: 'news' }))

    const conflict: any = conflictFromUniqueViolation(error, tags)
    expect(conflict.statusCode).toBe(409)
    expect(conflict.message).toBe('A record with this name already exists')
    expect(conflict.data.errors).toEqual([{ path: ['name'], message: 'Already exists' }])
  })

  it('a composite unique index names every column, mapped from DB names (org_id → orgId)', async () => {
    const db = setup()
    await db.insert(articles).values({ orgId: 'a', slug: 'hello', title: 'One' })
    const error = await caught(() => db.insert(articles).values({ orgId: 'a', slug: 'hello', title: 'Two' }))

    const conflict: any = conflictFromUniqueViolation(error, articles)
    expect(conflict.statusCode).toBe(409)
    expect(conflict.data.errors.map((e: any) => e.path[0])).toEqual(['orgId', 'slug'])
  })

  it('reads PostgreSQL and MySQL duplicate-key errors, including wrapped in a cause', () => {
    const pg = Object.assign(new Error('duplicate key value violates unique constraint "tags_name_key"'), { code: '23505', detail: 'Key (name)=(news) already exists.' })
    expect(uniqueViolationColumns(new Error('Failed query', { cause: pg }))).toEqual(['name'])
    expect(uniqueViolationColumns(Object.assign(new Error('Duplicate entry \'news\' for key \'tags.name\''), { code: 'ER_DUP_ENTRY', errno: 1062 }))).toEqual([])
    // PlanetScale's driver: no code or errno property, only the message
    expect(uniqueViolationColumns(new Error('Failed query', { cause: new Error('Duplicate entry \'news\' for key \'tags.tags_name_unique\' (errno 1062) (sqlstate 23000)') }))).toEqual([])
    expect((conflictFromUniqueViolation(Object.assign(new Error('dup'), { errno: 1062 }), tags) as any).message)
      .toBe('A record with these values already exists')
  })

  it('leaves every other error unchanged', () => {
    const other = new Error('FOREIGN KEY constraint failed')
    expect(conflictFromUniqueViolation(other, tags)).toBe(other)
    const notFound = Object.assign(new Error('Not found'), { statusCode: 404 })
    expect(conflictFromUniqueViolation(notFound, tags)).toBe(notFound)
  })
})
