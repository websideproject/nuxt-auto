import { describe, it, expect } from 'vitest'
import { sqliteTable, text, getTableConfig as getSqliteConfig } from 'drizzle-orm/sqlite-core'
import { pgTable, getTableConfig as getPgConfig } from 'drizzle-orm/pg-core'
import { mysqlTable, varchar as mysqlVarchar, getTableConfig as getMysqlConfig } from 'drizzle-orm/mysql-core'

import * as sqlitePresets from '../../../src/runtime/schema/sqlite'
import * as pgPresets from '../../../src/runtime/schema/pg'
import * as mysqlPresets from '../../../src/runtime/schema/mysql'

// Cross-dialect: the three modules expose the same API; only column types differ. These tests
// assert the column SHAPE (canonical snake_case names) and — critically — that index names are
// namespaced per table so two tables adopting the same preset don't collide (SQLite/Postgres
// require globally-unique index names; a fixed `trash_idx` was the original bug).

describe('schema presets — column shape', () => {
  it('softDelete() produces the four lifecycle columns by default', () => {
    const sd = sqlitePresets.softDelete()
    expect(Object.keys(sd.columns).sort()).toEqual(
      ['deletedAt', 'deletedBy', 'deletionId', 'deletedReason'].sort(),
    )
  })

  it('softDelete() options drop columns', () => {
    const sd = sqlitePresets.softDelete({ by: false, batch: false, reason: false })
    expect(Object.keys(sd.columns)).toEqual(['deletedAt'])
  })

  it('audit() produces createdBy + updatedBy', () => {
    expect(Object.keys(sqlitePresets.audit()).sort()).toEqual(['createdBy', 'updatedBy'])
  })

  it('canonical snake_case DB column names are used (auto-api detects by name)', () => {
    const sd = sqlitePresets.softDelete()
    const t = sqliteTable('t', {
      id: text('id').primaryKey(),
      ...sqlitePresets.audit(),
      ...sd.columns,
    })
    const names = getSqliteConfig(t).columns.map(c => c.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'created_by', 'updated_by', 'deleted_at', 'deleted_by', 'deletion_id', 'deleted_reason',
      ]),
    )
  })
})

describe('schema presets — index names are namespaced per table (regression)', () => {
  function sqliteIdx(tableName: string) {
    const sd = sqlitePresets.softDelete()
    const t = sqliteTable(tableName, {
      id: text('id').primaryKey(),
      ...sqlitePresets.tenant(),
      ...sd.columns,
    }, tbl => [...sd.indexes(tbl), ...sqlitePresets.tenant.indexes(tbl)])
    return getSqliteConfig(t).indexes.map(i => i.config.name)
  }

  it('prefixes softDelete + tenant index names with the table name', () => {
    expect(sqliteIdx('articles')).toEqual([
      'articles_trash_idx',
      'articles_batch_idx',
      'articles_tenant_org_idx',
    ])
  })

  it('two tables adopting the same presets do NOT collide on index names', () => {
    const a = sqliteIdx('articles')
    const b = sqliteIdx('comments')
    const overlap = a.filter(n => b.includes(n))
    expect(overlap).toEqual([])
  })

  it('pg dialect namespaces identically', () => {
    const sd = pgPresets.softDelete()
    const t = pgTable('articles', {
      ...pgPresets.id(),
      ...pgPresets.tenant(),
      ...sd.columns,
    }, tbl => [...sd.indexes(tbl), ...pgPresets.tenant.indexes(tbl)])
    expect(getPgConfig(t).indexes.map(i => i.config.name)).toEqual([
      'articles_trash_idx',
      'articles_batch_idx',
      'articles_tenant_org_idx',
    ])
  })

  it('mysql dialect namespaces identically', () => {
    const sd = mysqlPresets.softDelete()
    const t = mysqlTable('articles', {
      ...mysqlPresets.id(),
      ...mysqlPresets.tenant(),
      ...sd.columns,
    }, tbl => [...sd.indexes(tbl), ...mysqlPresets.tenant.indexes(tbl)])
    expect(getMysqlConfig(t).indexes.map(i => i.config.name)).toEqual([
      'articles_trash_idx',
      'articles_batch_idx',
      'articles_tenant_org_idx',
    ])
  })

  it('softDelete({ batch: false }) omits the batch index', () => {
    const sd = sqlitePresets.softDelete({ batch: false })
    const t = sqliteTable('articles', {
      id: text('id').primaryKey(),
      ...sd.columns,
    }, tbl => [...sd.indexes(tbl)])
    expect(getSqliteConfig(t).indexes.map(i => i.config.name)).toEqual(['articles_trash_idx'])
  })
})

describe('schema presets — liveUnique', () => {
  it('sqlite produces a partial unique index filtered to live rows', () => {
    const sd = sqlitePresets.softDelete()
    const t = sqliteTable('articles', {
      id: text('id').primaryKey(),
      slug: text('slug').notNull(),
      ...sd.columns,
    }, tbl => [sqlitePresets.liveUnique(tbl, tbl.slug, 'articles_slug_live')])
    const idx = getSqliteConfig(t).indexes[0]
    expect(idx!.config.name).toBe('articles_slug_live_uq')
    expect(idx!.config.unique).toBe(true)
    expect(idx!.config.where).toBeDefined() // partial — WHERE deleted_at IS NULL
  })

  // OUT-7. This took a single column and forwarded it straight to `.on()`, so an ARRAY (the obvious way
  // to ask for a composite) or a mistyped column name (`t.slugg` → undefined) both emitted `ON "t" ()` —
  // invalid SQL that nothing notices until drizzle-kit generates a migration and D1 rejects it. It
  // shipped a broken index twice that way.
  it('sqlite liveUnique accepts an array of columns, for a composite', () => {
    const sd = sqlitePresets.softDelete()
    const t = sqliteTable('posts', {
      id: text('id').primaryKey(),
      orgId: text('org_id').notNull(),
      slug: text('slug').notNull(),
      ...sd.columns,
    }, tbl => [sqlitePresets.liveUnique(tbl, [tbl.orgId, tbl.slug], 'posts_org_slug_live')])
    const idx = getSqliteConfig(t).indexes[0]
    expect(idx!.config.name).toBe('posts_org_slug_live_uq')
    expect(idx!.config.columns.map((c: any) => c.name)).toEqual(['org_id', 'slug'])
    expect(idx!.config.where).toBeDefined()
  })

  it('sqlite liveUnique throws on a missing column instead of emitting `ON table ()`', () => {
    const t: any = {}
    // A mistyped column name is `undefined`, which is exactly how this failed in the wild.
    expect(() => sqlitePresets.liveUnique(t, undefined, 'posts_typo')).toThrow(/liveUnique\("posts_typo"\)/)
    expect(() => sqlitePresets.liveUnique(t, [], 'posts_empty')).toThrow(/non-empty array/)
    expect(() => sqlitePresets.liveUnique(t, [{ name: 'slug' }, undefined], 'posts_hole')).toThrow(/empty slot/)
  })

  it('mysql liveUniqueMysql adds a stored generated <col>_live column', () => {
    const t = mysqlTable('articles', {
      ...mysqlPresets.id(),
      ...mysqlPresets.softDelete().columns,
      ...mysqlPresets.liveUniqueMysql('slug'),
    })
    const col = getMysqlConfig(t).columns.find(c => c.name === 'slug_live') as any
    expect(col).toBeDefined()
    expect(col.generated.mode).toBe('stored')
    expect((t as any).slugLive).toBe(col)
  })

  it('mysql liveUnique indexes the generated column, alone or in a composite', () => {
    const t = mysqlTable('articles', {
      ...mysqlPresets.id(),
      ...mysqlPresets.tenant(),
      ...mysqlPresets.softDelete().columns,
      ...mysqlPresets.liveUniqueMysql('slug'),
    }, tbl => [
      mysqlPresets.liveUnique(tbl, tbl.slugLive, 'articles_slug_live'),
      mysqlPresets.liveUnique(tbl, [(tbl as any).organizationId, tbl.slugLive], 'articles_org_slug_live'),
    ])
    expect(getMysqlConfig(t).indexes.map(i => [i.config.name, i.config.unique, i.config.columns.map((c: any) => c.name)])).toEqual([
      ['articles_slug_live_uq', true, ['slug_live']],
      ['articles_org_slug_live_uq', true, ['organization_id', 'slug_live']],
    ])
  })

  it('mysql liveUnique refuses a plain column (trashed rows would collide)', () => {
    const t = mysqlTable('articles', { slug: mysqlVarchar('slug', { length: 255 }) }, tbl => [mysqlPresets.liveUnique(tbl, tbl.slug, 'articles_slug_live')])
    expect(() => getMysqlConfig(t)).toThrow(/liveUniqueMysql/)
  })
})

describe('schema presets — id', () => {
  it('serial mode gives an auto-increment integer key on every dialect', () => {
    const s = getSqliteConfig(sqliteTable('a', sqlitePresets.id({ mode: 'serial' }))).columns[0] as any
    expect([s.columnType, s.primary, s.autoIncrement]).toEqual(['SQLiteInteger', true, true])
    const p = getPgConfig(pgTable('a', pgPresets.id({ mode: 'serial' }))).columns[0] as any
    expect([p.columnType, p.primary]).toEqual(['PgSerial', true])
    const m = getMysqlConfig(mysqlTable('a', mysqlPresets.id({ mode: 'serial' }))).columns[0] as any
    expect([m.columnType, m.primary, m.autoIncrement]).toEqual(['MySqlInt', true, true])
  })

  it('uuid mode is the default', () => {
    const s = getSqliteConfig(sqliteTable('a', sqlitePresets.id())).columns[0] as any
    expect(s.columnType).toBe('SQLiteText')
  })
})

describe('schema presets — tenant with a custom field', () => {
  it('tenant.indexes(t, { field }) indexes that column', () => {
    for (const [presets, table, getConfig] of [[sqlitePresets, sqliteTable, getSqliteConfig], [pgPresets, pgTable, getPgConfig], [mysqlPresets, mysqlTable, getMysqlConfig]] as const) {
      const t = (table as any)('docs', { ...(presets as any).tenant({ field: 'workspaceId' }) }, (tbl: any) => (presets as any).tenant.indexes(tbl, { field: 'workspaceId' }))
      const [idx] = (getConfig as any)(t).indexes
      expect([idx.config.name, idx.config.columns.map((c: any) => c.name)]).toEqual(['docs_tenant_workspace_id_idx', ['workspace_id']])
    }
  })

  it('names the missing field instead of indexing nothing', () => {
    const t = sqliteTable('docs', { ...sqlitePresets.tenant({ field: 'workspaceId' }) }, tbl => sqlitePresets.tenant.indexes(tbl))
    expect(() => getSqliteConfig(t)).toThrow(/no "organizationId" column/)
  })
})
