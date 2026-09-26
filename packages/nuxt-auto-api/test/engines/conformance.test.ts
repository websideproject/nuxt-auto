import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { initializeDatabase } from '../../src/runtime/server/database'
import type { DatabaseAdapter } from '../../src/runtime/types/database'
import { createHandler } from '../../src/runtime/server/handlers/create'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { updateHandler } from '../../src/runtime/server/handlers/update'
import { deleteHandler } from '../../src/runtime/server/handlers/delete'
import { restoreHandler } from '../../src/runtime/server/handlers/restore'
import { aggregateHandler } from '../../src/runtime/server/handlers/aggregate'
import { bulkCreateHandler, bulkUpdateHandler, bulkDeleteHandler } from '../../src/runtime/server/handlers/bulk'
import { m2mSyncHandler } from '../../src/runtime/server/handlers/m2m/sync'
import { m2mAddHandler } from '../../src/runtime/server/handlers/m2m/add'
import { m2mRemoveHandler } from '../../src/runtime/server/handlers/m2m/remove'
import { m2mBatchHandler } from '../../src/runtime/server/handlers/m2m/batch'
import { m2mListHandler } from '../../src/runtime/server/handlers/m2m/list'
import { permissionsHandler } from '../../src/runtime/server/handlers/permissions'
import { searchCondition } from '../../src/runtime/plugins/searchPlugin'
import { createRevisionPlugin } from '../../src/runtime/plugins/revisionPlugin'
import { makeContext } from '../helpers/context'
import { ENGINES, type TestEngine } from './engines'

vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, autoApi: {} }))

/**
 * The same requests against every database engine, through the real adapter (`initializeDatabase`) — not a
 * mocked transaction. Postgres/MySQL/PlanetScale need a URL (see engines.ts); the rest always run.
 */
for (const spec of ENGINES) {
  describe.skipIf(!spec.available)(`engine: ${spec.engine}`, () => {
    let t: TestEngine
    let adapter: DatabaseAdapter

    beforeAll(async () => {
      t = await spec.connect()
      adapter = initializeDatabase(t.db, t.engine)
    }, 60_000)
    afterAll(async () => {
      await t?.close()
    })
    beforeEach(async () => {
      adapter = initializeDatabase(t.db, t.engine)
      for (const table of t.schema.tables) await t.db.delete(table)
    })

    const ctx = (resource: string, over: Omit<Partial<Parameters<typeof makeContext>[0]>, 'db' | 'schema' | 'resource'> = {}) => {
      const context = makeContext({ db: t.db, schema: t.schema.resources, resource, ...over })
      context.adapter = adapter
      return context
    }
    const create = async (resource: string, body: any) => (await createHandler(ctx(resource, { operation: 'create', body }))).data as any
    const rows = (resource: keyof ReturnType<typeof import('./schema').buildSchema>['full']) => t.db.select().from((t.schema.full as any)[resource])
    const project = (name = 'P') => create('projects', { name })
    const tagsNamed = (...names: string[]) => Promise.all(names.map(name => create('tags', { name })))

    it('create / get / update / hard delete', async () => {
      const p = await project('Alpha')
      expect(p).toMatchObject({ name: 'Alpha' })
      expect(typeof p.id).toBe('number')

      const got = await getHandler(ctx('projects', { operation: 'get', params: { id: String(p.id) } }))
      expect(got.data).toMatchObject({ id: p.id, name: 'Alpha' })

      const up = await updateHandler(ctx('projects', { operation: 'update', params: { id: String(p.id) }, body: { name: 'Beta', id: 999 } }))
      expect(up.data).toMatchObject({ id: p.id, name: 'Beta' })

      const tag = (await tagsNamed('x'))[0]
      await deleteHandler(ctx('tags', { operation: 'delete', params: { id: String(tag.id) } }))
      expect(await rows('tags')).toHaveLength(0)
    })

    it('a client cannot choose a key the database generates', async () => {
      const huge = await create('tags', { id: 2147483647, name: 'huge' })
      expect(huge.id).not.toBe(2147483647)
      const next = await create('tags', { name: 'next' })
      expect(next.id).toBeGreaterThan(huge.id)
    })

    it('text primary key chosen by the client', async () => {
      const d = await create('docs', { id: 'doc-1', title: 'Readme' })
      expect(d).toMatchObject({ id: 'doc-1', title: 'Readme' })
      const up = await updateHandler(ctx('docs', { operation: 'update', params: { id: 'doc-1' }, body: { title: 'Guide' } }))
      expect(up.data).toMatchObject({ id: 'doc-1', title: 'Guide' })
    })

    it('list: filter, sort, keyset cursor, include, count', async () => {
      const a = await project('A')
      const b = await project('B')
      await project('C')
      await create('tasks', { projectId: a.id, title: 'a1' })
      await create('tasks', { projectId: a.id, title: 'a2', done: true })
      await create('tasks', { projectId: b.id, title: 'b1' })

      const filtered = await listHandler(ctx('tasks', { query: { filter: { done: false }, sort: 'title' } }))
      expect(filtered.data.map((r: any) => r.title)).toEqual(['a1', 'b1'])

      const seen: string[] = []
      let cursor: string | undefined = ''
      for (let i = 0; i < 5 && cursor !== undefined; i++) {
        const page: any = await listHandler(ctx('projects', { query: { sort: '-name', limit: 2, cursor } }))
        seen.push(...page.data.map((r: any) => r.name))
        cursor = page.meta?.nextCursor ?? undefined
      }
      expect(seen).toEqual(['C', 'B', 'A'])

      const withTasks: any = await listHandler(ctx('projects', { query: { include: 'tasks', sort: 'name' } }))
      expect(withTasks.data[0].tasks.map((t: any) => t.title).sort()).toEqual(['a1', 'a2'])
      expect(withTasks.data[2].tasks).toEqual([])

      const withProject: any = await listHandler(ctx('tasks', { query: { include: 'project', sort: 'title' } }))
      expect(withProject.data[2].project).toMatchObject({ name: 'B' })
    })

    it('aggregate with groupBy', async () => {
      const a = await project('A')
      for (const title of ['1', '2', '3']) await create('tasks', { projectId: a.id, title, done: title === '1' })
      const res: any = await aggregateHandler(ctx('tasks', { operation: 'aggregate', query: { aggregate: 'count', groupBy: 'done' } }))
      const counts = Object.fromEntries(res.data.map((g: any) => [String(Boolean(Number(g.group.done))), Number(g.count)]))
      expect(counts).toEqual({ true: 1, false: 2 })
    })

    it('soft delete cascades to children, nulls set-null FKs, and restores as one batch', async () => {
      const p = await project('Doomed')
      const task = await create('tasks', { projectId: p.id, title: 't' })
      await create('notes', { projectId: p.id, body: 'n' })

      const del: any = await deleteHandler(ctx('projects', { operation: 'delete', params: { id: String(p.id) } }))
      expect(del).toMatchObject({ softDeleted: true })

      const [trashedTask] = await rows('tasks')
      expect(trashedTask.deletedAt).not.toBeNull()
      expect(trashedTask.deletionId).toBe(del.deletionId)
      expect((await rows('notes'))[0].projectId).toBeNull()
      const reader = { tasks: { permissions: { read: true } } }
      await expect(getHandler(ctx('tasks', { operation: 'get', params: { id: String(task.id) }, auth: reader }))).rejects.toMatchObject({ statusCode: 404 })

      await restoreHandler(ctx('projects', { operation: 'update', params: { id: String(p.id) } }))
      const [restoredTask] = await rows('tasks')
      expect(restoredTask.deletedAt).toBeNull()
      expect(restoredTask.deletionId).toBeNull()
    })

    it('purge (?force=true) hard-deletes and the database cascades', async () => {
      const p = await project()
      await create('tasks', { projectId: p.id, title: 't' })
      await deleteHandler(ctx('projects', { operation: 'delete', params: { id: String(p.id) }, query: { force: 'true' } }))
      expect(await rows('projects')).toHaveLength(0)
      expect(await rows('tasks')).toHaveLength(0)
    })

    it('bulk create / update / delete', async () => {
      const created: any = await bulkCreateHandler(ctx('tags', { operation: 'bulk', body: { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] } }))
      expect(created.data.map((r: any) => r.name)).toEqual(['a', 'b', 'c'])
      expect(created.data.every((r: any) => typeof r.id === 'number')).toBe(true)

      const ids = created.data.map((r: any) => r.id)
      const updated: any = await bulkUpdateHandler(ctx('tags', { operation: 'bulk', body: { items: ids.map((id: number, i: number) => ({ id, data: { name: `n${i}` } })) } }))
      expect(updated.data.map((r: any) => r.name)).toEqual(['n0', 'n1', 'n2'])

      await bulkDeleteHandler(ctx('tags', { operation: 'bulk', body: { ids: ids.slice(0, 2) } }))
      expect((await rows('tags')).map((r: any) => r.name)).toEqual(['n2'])
    })

    it('bulk create is all-or-nothing when the database rejects an item', async () => {
      await tagsNamed('taken')
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error: any = await bulkCreateHandler(ctx('tags', { operation: 'bulk', body: { items: [{ name: 'fresh-1' }, { name: 'fresh-2' }, { name: 'taken' }] } })).catch(e => e)
      spy.mockRestore()
      expect(error.statusCode).toBe(400)
      // the database's message (SQL, bound values of every item) stays on the server
      expect(JSON.stringify(error.data)).not.toMatch(/insert|fresh-1|params/i)
      expect((await rows('tags')).map((r: any) => r.name)).toEqual(['taken'])
    })

    it('bulk update is all-or-nothing when the database rejects an item', async () => {
      const [a, b] = await tagsNamed('a', 'b')
      await expect(bulkUpdateHandler(ctx('tags', { operation: 'bulk', body: { items: [{ id: a.id, data: { name: 'renamed' } }, { id: b.id, data: { name: 'renamed' } }] } })))
        .rejects.toMatchObject({ statusCode: 400 })
      expect((await rows('tags')).map((r: any) => r.name).sort()).toEqual(['a', 'b'])
    })

    it('bulk soft delete cascades under one deletionId', async () => {
      const [p1, p2] = [await project('1'), await project('2')]
      await create('tasks', { projectId: p1.id, title: 't1' })
      await create('tasks', { projectId: p2.id, title: 't2' })
      const res: any = await bulkDeleteHandler(ctx('projects', { operation: 'bulk', body: { ids: [p1.id, p2.id] } }))
      const tasks = await rows('tasks')
      expect(tasks.every((t: any) => t.deletedAt && t.deletionId === res.meta.deletionId)).toBe(true)
      expect((await rows('projects')).every((p: any) => p.deletionId === res.meta.deletionId)).toBe(true)
    })

    it('m2m: sync with metadata, add, remove, list, batch', async () => {
      const p = await project()
      const [vue, nuxt, ts] = await tagsNamed('vue', 'nuxt', 'ts')
      const m2m = (params: Record<string, string>, body?: any) => ctx('projects', { operation: 'update', params: { id: String(p.id), relation: 'tags', ...params }, body })

      const sync = await m2mSyncHandler(m2m({}, { ids: [vue.id, nuxt.id], metadata: [{ role: 'primary' }, { role: 'secondary' }] }))
      expect(sync).toMatchObject({ added: 2, removed: 0, total: 2 })
      const links = await rows('projectTags')
      expect(links.find((l: any) => l.tagId === vue.id)?.role).toBe('primary')

      expect(await m2mAddHandler(m2m({}, { ids: [ts.id] }))).toMatchObject({ added: 1 })
      expect(await m2mRemoveHandler(m2m({}, { ids: [vue.id] }))).toMatchObject({ removed: 1 })

      const list: any = await m2mListHandler(ctx('projects', { params: { id: String(p.id), relation: 'tags' } }))
      expect(list.ids.map(Number).sort()).toEqual([nuxt.id, ts.id].sort())

      const batch = await m2mBatchHandler(ctx('projects', { operation: 'update', params: { id: String(p.id) }, body: { relations: { tags: { ids: [vue.id] } } } }))
      expect(batch.results.tags).toMatchObject({ added: 1, removed: 2, total: 1 })
      expect((await rows('projectTags')).map((l: any) => l.tagId)).toEqual([vue.id])
    })

    it('m2m sync of 150 ids (past D1\'s 100 bound parameters per statement)', async () => {
      const p = await project()
      const many = await bulkCreateHandler(ctx('tags', { operation: 'bulk', autoApi: { bulk: { maxBatchSize: 200 } }, body: { items: Array.from({ length: 150 }, (_, i) => ({ name: `t${i}` })) } }))
      const ids = (many.data as any[]).map(r => r.id)
      const sync = await m2mSyncHandler(ctx('projects', { operation: 'update', params: { id: String(p.id), relation: 'tags' }, body: { ids } }))
      expect(sync).toMatchObject({ added: 150, total: 150 })
      const resync = await m2mSyncHandler(ctx('projects', { operation: 'update', params: { id: String(p.id), relation: 'tags' }, body: { ids: ids.slice(0, 10) } }))
      expect(resync).toMatchObject({ removed: 140, total: 10 })
    })

    it('list include over 100 parents (D1 bound-parameter limit)', async () => {
      const created: any = await bulkCreateHandler(ctx('projects', { operation: 'bulk', autoApi: { bulk: { maxBatchSize: 200 } }, body: { items: Array.from({ length: 120 }, (_, i) => ({ name: `p${String(i).padStart(3, '0')}` })) } }))
      await create('tasks', { projectId: created.data[119].id, title: 'last' })
      const res: any = await listHandler(ctx('projects', { query: { include: 'tasks', sort: 'name', limit: 120 }, autoApi: { pagination: { maxLimit: 200 } } }))
      expect(res.data).toHaveLength(120)
      expect(res.data[119].tasks.map((x: any) => x.title)).toEqual(['last'])
    })

    it('a child trashed on its own keeps its batch when the parent is deleted later', async () => {
      const p = await project()
      const early = await create('tasks', { projectId: p.id, title: 'early' })
      await create('tasks', { projectId: p.id, title: 'late' })
      const first: any = await deleteHandler(ctx('tasks', { operation: 'delete', params: { id: String(early.id) } }))
      const second: any = await deleteHandler(ctx('projects', { operation: 'delete', params: { id: String(p.id) } }))

      const byTitle = Object.fromEntries((await rows('tasks')).map((r: any) => [r.title, r.deletionId]))
      expect(byTitle).toEqual({ early: first.deletionId, late: second.deletionId })

      await restoreHandler(ctx('projects', { operation: 'update', params: { id: String(p.id) } }))
      const live = (await rows('tasks')).filter((r: any) => r.deletedAt === null).map((r: any) => r.title)
      expect(live).toEqual(['late'])
    })

    it('an atomic() inside another joins it, and rolls back with it', async () => {
      if (!adapter.supportsTransactions) return
      const { tags } = t.schema.full
      await expect(adapter.atomic(async ({ tx }) => {
        await tx.insert(tags).values({ name: 'outer' })
        await adapter.atomic(async ({ tx: inner }) => inner.insert(tags).values({ name: 'inner' }))
        throw new Error('abort')
      })).rejects.toThrow('abort')
      expect(await rows('tags')).toEqual([])
    })

    it('m2m remove reports what was actually unlinked and what is left', async () => {
      const p = await project()
      const [a, b, c] = await tagsNamed('a', 'b', 'c')
      const m2m = (body: any) => ctx('projects', { operation: 'update', params: { id: String(p.id), relation: 'tags' }, body })
      await m2mSyncHandler(m2m({ ids: [a.id, b.id] }))
      expect(await m2mRemoveHandler(m2m({ ids: [a.id, c.id] }))).toMatchObject({ removed: 1, total: 1 })
    })

    it('tenant scoping: another organization\'s rows are invisible', async () => {
      const scoped = { projects: { permissions: { read: true, update: true, delete: true, create: true } } }
      const as = (org: string) => ({ auth: scoped, tenant: { id: org, field: 'organizationId', canAccessAllTenants: false }, autoApi: { multiTenancy: { enabled: true, tenantIdField: 'organizationId' } } } as any)
      const mine: any = await createHandler(ctx('projects', { operation: 'create', body: { name: 'mine', organizationId: 'org-b' }, ...as('org-a') }))
      expect(mine.data.organizationId).toBe('org-a')
      await createHandler(ctx('projects', { operation: 'create', body: { name: 'theirs' }, ...as('org-b') }))

      const list: any = await listHandler(ctx('projects', { query: {}, ...as('org-a') }))
      expect(list.data.map((r: any) => r.name)).toEqual(['mine'])
      const theirs = (await rows('projects')).find((r: any) => r.name === 'theirs')
      await expect(getHandler(ctx('projects', { operation: 'get', params: { id: String(theirs.id) }, ...as('org-a') }))).rejects.toMatchObject({ statusCode: 404 })
      await expect(updateHandler(ctx('projects', { operation: 'update', params: { id: String(theirs.id) }, body: { name: 'x' }, ...as('org-a') }))).rejects.toMatchObject({ statusCode: 404 })
    })

    it('update stamps updatedAt as a real date', async () => {
      const p = await project()
      const before = Date.now() - 2000
      await updateHandler(ctx('projects', { operation: 'update', params: { id: String(p.id) }, body: { name: 'renamed' } }))
      const [row] = await rows('projects')
      expect(row.updatedAt).toBeInstanceOf(Date)
      expect(row.updatedAt.getTime()).toBeGreaterThan(before)
    })

    it('$in filters: a list that fits the engine works, a larger one is a 400 (not a database error)', async () => {
      const [a] = await tagsNamed('a', 'b')
      const res: any = await listHandler(ctx('tags', { query: { filter: { id: { $in: [a.id, -1, -2] } } } }))
      expect(res.data.map((r: any) => r.name)).toEqual(['a'])
      const tooMany = Array.from({ length: 501 }, (_, i) => i)
      await expect(listHandler(ctx('tags', { query: { filter: { id: { $in: tooMany } } } }))).rejects.toMatchObject({ statusCode: 400 })
      if (spec.engine === 'd1') {
        await expect(listHandler(ctx('tags', { query: { filter: { id: { $in: tooMany.slice(0, 51) } } } }))).rejects.toMatchObject({ statusCode: 400 })
      }
    })

    it('$or and a date range filter', async () => {
      await tagsNamed('alpha', 'beta', 'gamma')
      const res: any = await listHandler(ctx('tags', { query: { filter: { $or: [{ name: { $like: 'alp' } }, { name: { $like: 'gam' } }] }, sort: 'name' } }))
      expect(res.data.map((r: any) => r.name)).toEqual(['alpha', 'gamma'])

      const p = await project()
      await updateHandler(ctx('projects', { operation: 'update', params: { id: String(p.id) }, body: { name: 'stamped' } }))
      const since = (ms: number) => listHandler(ctx('projects', { query: { filter: { updatedAt: { $gte: new Date(Date.now() + ms).toISOString() } } } }))
      expect(((await since(-60_000)) as any).data.map((r: any) => r.name)).toEqual(['stamped'])
      expect(((await since(60_000)) as any).data).toEqual([])
    })

    it('restore / purge / trash are reported only for soft-deletable tables', async () => {
      const soft = await permissionsHandler(ctx('projects', { operation: 'permissions' as any }))
      const hard = await permissionsHandler(ctx('tags', { operation: 'permissions' as any }))
      expect(soft).toMatchObject({ canDelete: true, canRestore: true, canPurge: true, canViewDeleted: true })
      expect(hard).toMatchObject({ canDelete: true, canRestore: false, canPurge: false, canViewDeleted: false })
    })

    it('search: case-insensitive substring, and % / _ in the term match literally', async () => {
      for (const name of ['Nuxt Guide', 'nuxt tips', 'Vue', '100% done', '100 percent', 'a_b', 'axb']) await tagsNamed(name)
      const search = async (term: string) => {
        const context = ctx('tags', { query: { sort: 'name' } })
        context.additionalFilters = [searchCondition([t.schema.full.tags.name], term)!]
        return (await listHandler(context)).data.map((r: any) => r.name)
      }
      expect(await search('NUXT')).toEqual(['Nuxt Guide', 'nuxt tips'])
      expect(await search('100%')).toEqual(['100% done'])
      expect(await search('a_b')).toEqual(['a_b'])
    })

    it('revision plugin: numbered snapshots, pruned to the newest N', async () => {
      const hooks: any = {}
      createRevisionPlugin({ maxRevisionsPerRecord: 2 }).runtimeSetup!({ addGlobalHook: (h: any) => Object.assign(hooks, h), logger: { info() {} } } as any)
      const p = await project('v1')
      const c = ctx('projects', { operation: 'update' })
      const errors: unknown[] = []
      const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
        errors.push(a)
      })
      await hooks.afterCreate(p, { ...c, operation: 'create' })
      for (const name of ['v2', 'v3', 'v4']) await hooks.afterUpdate({ ...p, name }, c)
      spy.mockRestore()
      expect(errors).toEqual([])
      const revs = (await rows('revisions')).sort((a: any, b: any) => a.version - b.version)
      expect(revs.map((r: any) => [r.version, r.data.name])).toEqual([[3, 'v3'], [4, 'v4']])
    })

    it('per-record permissions: resource permission AND row visibility AND objectLevel, per operation', async () => {
      const [open, locked, hidden] = await tagsNamed('open', 'locked', 'hidden')
      const auth = {
        tags: {
          permissions: { read: true, update: true },
          listFilter: (table: any) => sql`${table.name} <> 'hidden'`,
          objectLevel: (row: any, c: any) => c.operation === 'get' || row.name !== 'locked',
        },
      }
      const ids = [open.id, locked.id, hidden.id, 999999].join(',')
      const res: any = await permissionsHandler(ctx('tags', { operation: 'get', auth, query: { ids } }))
      expect(res.records[String(open.id)]).toEqual({ canRead: true, canUpdate: true, canDelete: false })
      expect(res.records[String(locked.id)]).toEqual({ canRead: true, canUpdate: false, canDelete: false })
      // invisible and missing rows answer the same way
      expect(res.records[String(hidden.id)]).toEqual(res.records['999999'])
      expect(res.records['999999']).toEqual({ canRead: false, canUpdate: false, canDelete: false })
    })

    it('reports the engine and whether atomic() is a transaction', () => {
      expect(adapter.engine).toBe(spec.engine)
      expect(adapter.supportsTransactions).toBe(spec.engine !== 'd1')
    })

    it('raw sql works through the adapter db', async () => {
      await project('raw')
      const count = await t.db.select({ n: sql<number>`count(*)` }).from(t.schema.full.projects).where(eq(t.schema.full.projects.name, 'raw'))
      expect(Number(count[0].n)).toBe(1)
    })
  })
}
