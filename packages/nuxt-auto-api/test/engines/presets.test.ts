import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { eq } from 'drizzle-orm'
import * as mysqlPresets from '../../src/runtime/schema/mysql'

/**
 * The MySQL presets against a real MySQL (AUTOAPI_TEST_MYSQL_URL, as in CI): the DDL drizzle-kit generates from
 * them is accepted, and `liveUnique` keeps a value unique among live rows only. A database of its own, so it can
 * run beside the conformance suite, which drops every table of its database.
 */
const url = process.env.AUTOAPI_TEST_MYSQL_URL

describe.skipIf(!url)('mysql presets on MySQL', () => {
  const sd = mysqlPresets.softDelete()
  const articles = mysqlTable('articles', {
    ...mysqlPresets.id({ mode: 'serial' }),
    ...mysqlPresets.tenant(),
    slug: varchar('slug', { length: 255 }).notNull(),
    ...sd.columns,
    ...mysqlPresets.liveUniqueMysql('slug'),
  }, (t: any) => [...sd.indexes(t), ...mysqlPresets.tenant.indexes(t), mysqlPresets.liveUnique(t, [t.organizationId, t.slugLive], 'articles_org_slug_live')])
  // The presets' columns are untyped (Record<string, any>); the tenant column is read through this.
  const org = (articles as any).organizationId

  let pool: any
  let db: any

  beforeAll(async () => {
    const { createPool } = await import('mysql2/promise')
    const { drizzle } = await import('drizzle-orm/mysql2')
    const { generateMySQLDrizzleJson, generateMySQLMigration } = await import('drizzle-kit/api')
    const admin = createPool({ uri: url! })
    await admin.query('DROP DATABASE IF EXISTS autoapi_presets')
    await admin.query('CREATE DATABASE autoapi_presets')
    await admin.end()
    const target = new URL(url!)
    target.pathname = '/autoapi_presets'
    pool = createPool({ uri: target.toString() })
    for (const stmt of await generateMySQLMigration(await generateMySQLDrizzleJson({}), await generateMySQLDrizzleJson({ articles }))) await pool.query(stmt)
    db = drizzle(pool, { schema: { articles }, mode: 'default' })
  }, 60_000)
  afterAll(async () => {
    await pool?.end()
  })

  it('keeps a slug unique among live rows of a tenant, and lets trashed rows repeat it', async () => {
    await db.insert(articles).values({ organizationId: 'o1', slug: 'hello' })
    await expect(db.insert(articles).values({ organizationId: 'o1', slug: 'hello' })).rejects.toThrow()
    // Another tenant may use it
    await db.insert(articles).values({ organizationId: 'o2', slug: 'hello' })

    // Trash the live one: the slug is free again, and two trashed rows may share it
    await db.update(articles).set({ deletedAt: new Date() }).where(eq(org, 'o1'))
    await db.insert(articles).values({ organizationId: 'o1', slug: 'hello' })
    await db.update(articles).set({ deletedAt: new Date() }).where(eq(org, 'o1'))
    await db.insert(articles).values({ organizationId: 'o1', slug: 'hello' })

    const rows = await db.select().from(articles).where(eq(org, 'o1'))
    expect(rows.map((r: any) => [typeof r.id, r.slugLive])).toEqual([['number', null], ['number', null], ['number', 'hello']])
  })
})
