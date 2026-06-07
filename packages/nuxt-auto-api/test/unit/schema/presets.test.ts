import { describe, it, expect, vi } from 'vitest'
import { sqliteTable, text, getTableConfig as getSqliteConfig } from 'drizzle-orm/sqlite-core'
import { pgTable, getTableConfig as getPgConfig } from 'drizzle-orm/pg-core'
import { mysqlTable, getTableConfig as getMysqlConfig } from 'drizzle-orm/mysql-core'

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
    expect(idx.config.name).toBe('articles_slug_live_uq')
    expect(idx.config.unique).toBe(true)
    expect(idx.config.where).toBeDefined() // partial — WHERE deleted_at IS NULL
  })

  it('mysql liveUnique warns (no filtered index support) — manual migration required', () => {
    // Contract: MySQL has no partial indexes, so liveUnique cannot create a correct
    // "unique among live rows" constraint. It warns and points the dev at liveUniqueMysql()
    // (generated-column workaround in a manual migration). We only assert the warning fires.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mysqlPresets.liveUnique({}, {}, 'articles_slug_live')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]![0]).toContain('articles_slug_live')
    warn.mockRestore()
  })

  it('mysql liveUniqueMysql warns about the manual migration step', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = mysqlPresets.liveUniqueMysql('slug', 'articles_slug_live')
    expect(out).toEqual({})
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
