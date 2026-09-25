import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase } from '../helpers/setup'
import * as baseSchema from '../helpers/schema'
import { listHandler } from '../../src/runtime/server/handlers/list'
import { getHandler } from '../../src/runtime/server/handlers/get'
import { makeContext, OPEN } from '../helpers/context'

vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, autoApi: {} }))

// Registered resources. `postTags` is deliberately NOT registered: a junction the app never exposed.
const { users, posts, comments, tags, postTags } = baseSchema
const resources = { users, posts, comments, tags }

describe('?include= — authorized like the related resource', () => {
  let db: any
  let sqlite: any
  let alice: any
  let bob: any

  beforeEach(async () => {
    ({ db, sqlite } = await setupTestDatabase(baseSchema))
    ;[alice, bob] = await db.insert(users).values([
      { email: 'alice@t', name: 'Alice', password: 'pw-a' },
      { email: 'bob@t', name: 'Bob', password: 'pw-b' },
    ]).returning()
    const [p1, p2, p3] = await db.insert(posts).values([
      { title: 'A1', userId: alice.id, organizationId: 'o1' },
      { title: 'A2', userId: alice.id, organizationId: 'o2' },
      { title: 'A3-trashed', userId: alice.id, organizationId: 'o1', deletedAt: new Date() },
    ]).returning()
    await db.insert(comments).values([
      { content: 'c1', postId: p1.id, userId: bob.id },
      { content: 'c2', postId: p1.id, userId: alice.id },
      { content: 'c3', postId: p1.id, userId: bob.id },
      { content: 'c4', postId: p2.id, userId: bob.id },
    ])
    const [t1, t2] = await db.insert(tags).values([{ name: 'red' }, { name: 'blue' }]).returning()
    await db.insert(postTags).values([{ postId: p1.id, tagId: t1.id }, { postId: p1.id, tagId: t2.id }, { postId: p3.id, tagId: t1.id }])
  })
  afterEach(() => sqlite.close())

  const list = (resource: string, query: Record<string, any>, over: Partial<Parameters<typeof makeContext>[0]> = {}) =>
    listHandler(makeContext({ db, schema: resources, resource, query: { sort: 'id', ...query }, ...over }))

  describe('loading', () => {
    it('loads to-one and to-many relations', async () => {
      const r = await list('posts', { include: 'author,comments' })
      const a1 = r.data.find((p: any) => p.title === 'A1')
      expect(a1.author.name).toBe('Alice')
      expect(a1.comments.map((c: any) => c.content)).toEqual(['c1', 'c2', 'c3'])
    })

    it('loads nested relations', async () => {
      const r = await list('posts', { include: 'comments.author' })
      expect(r.data[0].comments[0].author.name).toBe('Bob')
    })

    it('works on get', async () => {
      const g = await getHandler(makeContext({ db, schema: resources, resource: 'posts', operation: 'get', params: { id: '1' }, query: { include: 'author' } }))
      expect(g.data.author.name).toBe('Alice')
    })

    it('selects fields — and strips the columns fetched only to authorize the rows', async () => {
      const r = await list('users', { include: 'posts[title]' })
      const alicePosts = r.data.find((u: any) => u.name === 'Alice').posts
      expect(alicePosts.length).toBeGreaterThan(0)
      for (const p of alicePosts) expect(Object.keys(p)).toEqual(['title'])
    })

    it('paginates and filters to-many relations', async () => {
      const limited = await list('posts', { include: 'comments{limit:2,offset:1}' })
      expect(limited.data[0].comments.map((c: any) => c.content)).toEqual(['c2', 'c3'])
      const filtered = await list('posts', { include: `comments{filter:${JSON.stringify({ userId: bob.id })}}` })
      expect(filtered.data[0].comments.map((c: any) => c.content)).toEqual(['c1', 'c3'])
    })
  })

  describe('validation (400)', () => {
    it.each([
      ['unknown relation', 'nope'],
      ['unknown nested relation', 'comments.nope'],
      ['unknown selected field', 'author[id,nope]'],
      ['hidden selected field', 'author[id,password]'],
      ['unknown filter field', 'comments{filter:{nope:1}}'],
      ['filter on a to-one relation', 'author{filter:{name:"x"}}'],
      ['limit on a to-one relation', 'author{limit:1}'],
      ['too deep', 'comments.post.comments.post'],
    ])('%s', async (_, include) => {
      await expect(list('posts', { include }, { extra: { users: { hiddenFields: ['password'] } } })).rejects.toMatchObject({ statusCode: 400 })
    })

    it('a filter on a hidden field of the related resource is refused, not used as an oracle', async () => {
      await expect(list('posts', { include: 'comments.author' }, { extra: { users: { hiddenFields: ['password'] } } })).resolves.toBeTruthy()
      await expect(list('users', { include: 'posts{filter:{title:"A1"}}' })).resolves.toBeTruthy()
      await expect(list('comments', { include: 'author' }, { extra: { users: { hiddenFields: ['password'] } }, query: { include: 'author', filter: { password: 'pw-a' } } } as any))
        .rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('authorization of the related resource', () => {
    it('403 when the caller may not read the related resource', async () => {
      const auth = { ...Object.fromEntries(Object.keys(resources).map(k => [k, OPEN])), users: { permissions: { read: 'users:read' } } }
      await expect(list('posts', { include: 'author' }, { auth, user: { id: 9 } })).rejects.toMatchObject({ statusCode: 403 })
      await expect(list('posts', { include: 'author' }, { auth })).rejects.toMatchObject({ statusCode: 401 })
      await expect(list('posts', { include: 'author' }, { auth, user: { id: 9 }, permissions: ['users:read'] })).resolves.toBeTruthy()
    })

    it('drops soft-deleted related rows', async () => {
      const r = await list('users', { include: 'posts' })
      expect(r.data.find((u: any) => u.name === 'Alice').posts.map((p: any) => p.title)).toEqual(['A1', 'A2'])
    })

    it('drops related rows from another tenant', async () => {
      const r = await list('users', { include: 'posts' }, { tenant: { id: 'o1', field: 'organizationId', canAccessAllTenants: false } })
      expect(r.data.find((u: any) => u.name === 'Alice').posts.map((p: any) => p.title)).toEqual(['A1'])
    })

    it('applies the related resource\'s listFilter (nulling a to-one relation)', async () => {
      const auth = { ...Object.fromEntries(Object.keys(resources).map(k => [k, OPEN])), users: { ...OPEN, listFilter: (t: any) => eq(t.name, 'Bob') } }
      const r = await list('comments', { include: 'author' }, { auth })
      expect(r.data.map((c: any) => c.author?.name ?? null)).toEqual(['Bob', null, 'Bob', 'Bob'])
    })

    it('applies the related resource\'s objectLevel check', async () => {
      const auth = { ...Object.fromEntries(Object.keys(resources).map(k => [k, OPEN])), comments: { ...OPEN, objectLevel: (row: any) => row.content !== 'c2' } }
      const r = await list('posts', { include: 'comments' }, { auth })
      expect(r.data[0].comments.map((c: any) => c.content)).toEqual(['c1', 'c3'])
    })

    it('strips the related resource\'s field-level unreadable columns and hidden fields', async () => {
      const auth = { ...Object.fromEntries(Object.keys(resources).map(k => [k, OPEN])), users: { ...OPEN, fields: { email: { read: false } } } }
      const r = await list('posts', { include: 'author' }, { auth, extra: { users: { hiddenFields: ['password'] } } })
      expect(r.data[0].author).toMatchObject({ name: 'Alice' })
      expect(r.data[0].author.email).toBeUndefined()
      expect(r.data[0].author.password).toBeUndefined()
    })

    it('an unregistered junction table is part of its parent, but soft delete / tenant still apply to registered hops', async () => {
      const r = await list('posts', { include: 'postTags.tag' })
      expect(r.data[0].postTags.map((pt: any) => pt.tag.name)).toEqual(['red', 'blue'])
      const tagsNoRead = { ...Object.fromEntries(Object.keys(resources).map(k => [k, OPEN])), tags: { permissions: { read: false } } }
      await expect(list('posts', { include: 'postTags.tag' }, { auth: tagsNoRead, user: { id: 1 } })).rejects.toMatchObject({ statusCode: 403 })
    })
  })
})
