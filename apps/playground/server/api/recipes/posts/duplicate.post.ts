import { z } from 'zod'
import { posts } from '../../../database/schema'

/**
 * Recipe: `authorize` + the row access helpers + `insertReturning`. Copy posts as drafts of the caller's own: the
 * body is validated with its own schema, `authorize` refuses (403) unless the caller may read every source post —
 * `findAuthorizedRows` returns the visible subset — and the copies are written with `insertReturning`
 * (`.returning()` on SQLite and Postgres, a read-back on MySQL).
 */

// Visibility as GET /api/posts/:id sees it (posts' objectLevel answers per operation)
const readable = (ctx: Parameters<typeof findAuthorizedRows>[0], ids: number[]) =>
  findAuthorizedRows({ ...ctx, operation: 'get' }, 'posts', ids)
export default createEndpoint({
  resource: 'posts',
  operation: 'create', // gated by posts' `create` permission
  body: z.object({ ids: z.array(z.number().int()).min(1).max(10) }),

  authorize: async ctx => (await readable(ctx, ctx.body.ids)).length === new Set(ctx.body.ids).size,

  async handler(ctx) {
    const sources = await readable(ctx, ctx.body.ids)
    return insertReturning(ctx.db, posts, sources.map(post => ({
      title: `${post.title} (copy)`,
      content: post.content,
      userId: Number(ctx.user!.id),
      published: false
    })))
  }
})
