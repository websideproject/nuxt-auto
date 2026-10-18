import { describe, it, expect } from 'vitest'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createAuditStampPlugin } from '../../../src/runtime/plugins/auditStampPlugin'
import { withDefaultPlugins } from '../../../src/runtime/server/plugins/initPlugins'
import type { PluginRuntimeContext } from '../../../src/runtime/types/plugin'

const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  title: text('title'),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
})
const tags = sqliteTable('tags', { id: text('id').primaryKey(), name: text('name') })

async function hooks() {
  let registered: any
  const addGlobalHook = (h: any) => {
    registered = h
  }
  await createAuditStampPlugin().runtimeSetup!({ addGlobalHook } as unknown as PluginRuntimeContext)
  return registered
}

const ctx = (resource: string, user?: { id: string }) => ({ resource, user, schema: { notes, tags } })

describe('withDefaultPlugins', () => {
  it('adds the audit-stamp plugin by default', () => {
    expect(withDefaultPlugins([], {}).map(p => p.name)).toEqual(['audit-stamp'])
    expect(withDefaultPlugins([], undefined).map(p => p.name)).toEqual(['audit-stamp'])
  })

  it('leaves it out with auditStamps: false', () => {
    expect(withDefaultPlugins([], { auditStamps: false })).toEqual([])
  })

  it('does not add a second copy when the app registers it', () => {
    const own = createAuditStampPlugin()
    expect(withDefaultPlugins([own], {})).toEqual([own])
  })
})

describe('createAuditStampPlugin', () => {
  it('stamps createdBy and updatedBy on create', async () => {
    const h = await hooks()
    expect(h.beforeCreate({ title: 'a' }, ctx('notes', { id: 'u1' }))).toEqual({ title: 'a', createdBy: 'u1', updatedBy: 'u1' })
  })

  it('stamps updatedBy on update', async () => {
    const h = await hooks()
    expect(h.beforeUpdate('n1', { title: 'b' }, ctx('notes', { id: 'u2' }))).toEqual({ title: 'b', updatedBy: 'u2' })
  })

  it('writes null without a user', async () => {
    const h = await hooks()
    expect(h.beforeCreate({}, ctx('notes'))).toEqual({ createdBy: null, updatedBy: null })
  })

  it('leaves tables without the columns alone', async () => {
    const h = await hooks()
    expect(h.beforeCreate({ name: 'x' }, ctx('tags', { id: 'u1' }))).toEqual({ name: 'x' })
    expect(h.beforeUpdate('t1', { name: 'y' }, ctx('tags', { id: 'u1' }))).toEqual({ name: 'y' })
  })
})
