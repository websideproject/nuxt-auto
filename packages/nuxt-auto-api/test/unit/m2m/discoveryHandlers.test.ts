import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { initializeDatabase } from '../../../src/runtime/server/database'
import listJunctions from '../../../src/runtime/server/handlers/m2m/list-junctions'
import detectRelationships from '../../../src/runtime/server/handlers/m2m/detect-relationships'
import { resetRegistry, setRegistry } from '../../helpers/registry-stub'
import { createMockH3Event } from '../../helpers/mocks'

const people = sqliteTable('people', { id: integer('id').primaryKey(), name: text('name') })
const skills = sqliteTable('skills', { id: integer('id').primaryKey(), name: text('name') })
const expertise = sqliteTable('expertise', {
  who: integer('who').notNull().references(() => people.id),
  what: integer('what').notNull().references(() => skills.id),
})

let runtimeConfig: any = { autoApi: {} }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

// Only people and skills are resources; the junction lives in the Drizzle schema alone.
beforeEach(() => {
  setRegistry({
    people: { name: 'people', schema: people, authorization: { permissions: { read: true } } },
    skills: { name: 'skills', schema: skills, authorization: { permissions: { read: true } } },
  })
  initializeDatabase(drizzle(new Database(':memory:'), { schema: { people, skills, expertise } }), 'better-sqlite3')
})
afterEach(() => {
  resetRegistry()
  runtimeConfig = { autoApi: {} }
})

const event = (params: Record<string, string> = {}) => createMockH3Event({ context: { user: { id: 'u1' }, params } }) as any

describe('M2M discovery', () => {
  it('lists a junction that is not a registered resource', async () => {
    expect(await (listJunctions as any)(event())).toEqual({ junctions: ['expertise'], count: 1 })
  })

  it('reports relationships through an unregistered junction', async () => {
    const result = await (detectRelationships as any)(event({ resource: 'people' }))
    expect(result.relationships).toEqual([
      expect.objectContaining({ relatedResource: 'skills', junction: expect.objectContaining({ tableName: 'expertise', leftKey: 'who', rightKey: 'what' }) }),
    ])
  })

  it('fills a relation configured with labels only from the detected junction', async () => {
    runtimeConfig = { autoApi: { m2m: { relations: { people: { skills: { label: 'Skills' } } } } } }
    const result = await (detectRelationships as any)(event({ resource: 'people' }))
    expect(result.relationships).toEqual([
      expect.objectContaining({ relatedResource: 'skills', label: 'Skills', junction: expect.objectContaining({ tableName: 'expertise', leftKey: 'who' }) }),
    ])
  })

  it('reports only configured relations with autoDetect off', async () => {
    runtimeConfig = { autoApi: { m2m: { autoDetect: false } } }
    expect((await (detectRelationships as any)(event({ resource: 'people' }))).relationships).toEqual([])
  })
})
