import { and, eq } from 'drizzle-orm'
import { posts } from '../../../../database/schema'

/**
 * Recipe: a named gate. `endpointName: 'publish'` is checked against `postsAuth.custom.publish` — editors and admins
 * may publish any post — instead of posts' own `update` rule, which lets authors edit only their own posts.
 */
export default createEndpoint({
  resource: 'posts',
  operation: 'update',
  endpointName: 'publish',

  async handler(ctx) {
    // The gate decided who may publish; the row still has to be visible to the caller
    const id = Number(ctx.params.id)
    const [post] = await ctx.db.select().from(posts).where(and(eq(posts.id, id), rowScope(ctx, 'posts', posts)))
    if (!post) throw createError({ statusCode: 404, message: `Post ${ctx.params.id} not found` })
    return updateReturning(ctx.db, posts, id, { published: true, updatedAt: new Date() })
  }
})
