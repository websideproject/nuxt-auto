import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { assertNoAccessFunctions, findActionsFile } from '../../src/module'
import type { ModuleOptions } from '../../src/module'
import { actionsAt, actionsFor, confirmMessage, isActionAllowed } from '../../src/runtime/utils/customActions'
import type { AdminActions } from '../../src/runtime/types'

const noop = () => {}
const actions: AdminActions = {
  posts: {
    publish: { label: 'Publish', type: 'single', location: ['row', 'detail'], permission: 'update', confirm: (p: { title: string }) => `Publish "${p.title}"?`, handler: noop },
    archive: { label: 'Archive', type: 'bulk', location: 'row', confirm: (ps: unknown[]) => `Archive ${ps.length}?`, handler: noop },
    exportAll: { label: 'Export', type: 'page-level', location: 'toolbar', handler: noop },
    stray: { label: 'Stray', type: 'single', location: 'toolbar', handler: noop },
  },
}

describe('custom actions', () => {
  it('groups a resource\'s actions by where they appear', () => {
    const all = actionsFor(actions, 'posts')
    expect(actionsAt(all, 'row', 'single').map(a => a.key)).toEqual(['publish'])
    expect(actionsAt(all, 'detail', 'single').map(a => a.key)).toEqual(['publish'])
    // bulk and page-level actions only ever sit on the toolbar, whatever `location` says
    expect(actionsAt(all, 'toolbar', 'bulk').map(a => a.key)).toEqual(['archive'])
    expect(actionsAt(all, 'row', 'bulk')).toEqual([])
    expect(actionsAt(all, 'toolbar', 'page-level').map(a => a.key)).toEqual(['exportAll'])
    // a single action has no toolbar place (it needs a record)
    expect(actionsAt(all, 'toolbar', 'single')).toEqual([])
    expect(actionsFor(actions, 'comments')).toEqual([])
    expect(actionsFor(undefined, 'posts')).toEqual([])
  })

  it('asks the confirmation of the item(s), or none', () => {
    const [publish, archive, exportAll] = actionsFor(actions, 'posts')
    expect(confirmMessage(publish!, { title: 'Hello' })).toBe('Publish "Hello"?')
    expect(confirmMessage(archive!, [1, 2, 3])).toBe('Archive 3?')
    expect(confirmMessage(exportAll!, undefined)).toBeNull()
    expect(confirmMessage({ ...exportAll!, confirm: 'Sure?' }, undefined)).toBe('Sure?')
  })

  it('answers an operation permission with the API\'s answer, a function with itself', () => {
    const [publish, , exportAll] = actionsFor(actions, 'posts')
    const asked: string[] = []
    const can = (op: string) => {
      asked.push(op)
      return op === 'read'
    }
    expect(isActionAllowed(publish!, { resource: 'posts', item: { id: 1 }, can })).toBe(false)
    expect(asked).toEqual(['update'])
    expect(isActionAllowed({ ...publish!, permission: 'read' }, { resource: 'posts', can })).toBe(true)
    expect(isActionAllowed(exportAll!, { resource: 'posts', can: () => false })).toBe(true)
    const own = { ...publish!, permission: ({ item }: { item?: { mine?: boolean } }) => !!item?.mine }
    expect(isActionAllowed(own, { resource: 'posts', item: { mine: true }, can: () => false })).toBe(true)
    expect(isActionAllowed(own, { resource: 'posts', item: {}, can: () => true })).toBe(false)
  })

  it('refuses actions in nuxt.config, where their handlers can never reach the app', () => {
    const options = { resources: { posts: { actions: { publish: { label: 'Publish', handler: noop } } } } } as unknown as ModuleOptions
    expect(() => assertNoAccessFunctions(options)).toThrow(/resources\.posts\.actions.*admin\.actions\.ts/)
    expect(() => assertNoAccessFunctions({ resources: { posts: { displayName: 'Posts' } } })).not.toThrow()
  })

  it('finds admin.actions.ts in the source directory, or nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'auto-admin-actions-'))
    expect(await findActionsFile(undefined, dir)).toBeNull()
    writeFileSync(join(dir, 'admin.actions.ts'), 'export default {}\n')
    expect(await findActionsFile(undefined, dir)).toBe(join(dir, 'admin.actions.ts'))
    expect(await findActionsFile(join(dir, 'admin.actions'), '/nowhere')).toBe(join(dir, 'admin.actions.ts'))
    await expect(findActionsFile(join(dir, 'missing'), dir)).rejects.toThrow(/not found/)
  })
})
