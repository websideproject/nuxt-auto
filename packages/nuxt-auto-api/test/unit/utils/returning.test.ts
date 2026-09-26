import { describe, it, expect } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql-proxy'
import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core'
import { sqliteTable, integer } from 'drizzle-orm/sqlite-core'
import { insertReturning, updateReturning, supportsReturning } from '../../../src/runtime/server/utils/returning'

// MySQL / PlanetScale have no RETURNING — Drizzle's MySQL builders have no `.returning()` at all, so the
// generic handlers crashed on every write. The helpers read the row back by primary key instead.
const users = mysqlTable('users', { id: int('id').primaryKey().autoincrement(), name: varchar('name', { length: 50 }) })

function recordingDb(rowsBySelect: any[][], insertId = 7) {
  const calls: Array<{ sql: string, params: any[] }> = []
  let selects = 0
  const db = drizzle(async (sql, params, method) => {
    calls.push({ sql, params })
    if (/^insert/i.test(sql)) return { rows: [{ insertId, affectedRows: 1 }] as any }
    if (/^update/i.test(sql)) return { rows: [{ affectedRows: 1 }] as any }
    const rows = rowsBySelect[selects++] ?? []
    return { rows: method === 'all' ? rows.map(r => Object.values(r)) : rows }
  })
  return { db, calls }
}

describe('returning helpers', () => {
  it('knows which dialects support RETURNING', () => {
    expect(supportsReturning(users)).toBe(false)
    expect(supportsReturning(sqliteTable('t', { id: integer('id') }))).toBe(true)
  })

  it('MySQL insert: $returningId() then read the row back', async () => {
    const { db, calls } = recordingDb([[{ id: 7, name: 'Ann' }]])
    const rows = await insertReturning(db, users, { name: 'Ann' })
    expect(calls.map(c => c.sql.split(' ')[0]!.toLowerCase())).toEqual(['insert', 'select'])
    expect(calls[1]!.params).toEqual([7])
    expect(rows).toEqual([{ id: 7, name: 'Ann' }])
  })

  it('MySQL update: update then read the row back by primary key', async () => {
    const { db, calls } = recordingDb([[{ id: 3, name: 'Bo' }]])
    const row = await updateReturning(db, users, 3, { name: 'Bo' })
    expect(calls.map(c => c.sql.split(' ')[0]!.toLowerCase())).toEqual(['update', 'select'])
    expect(row).toEqual({ id: 3, name: 'Bo' })
  })
})
