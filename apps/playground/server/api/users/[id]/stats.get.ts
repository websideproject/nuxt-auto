import { eq, count } from 'drizzle-orm'
import { posts, comments } from '../../../database/schema'

/**
 * Custom endpoint using createEndpoint (auto-imported).
 * Demonstrates: resource-bound endpoint, row access helpers, response filtering.
 */
export default createEndpoint({
  resource: 'users',
  operation: 'get',

  async handler(ctx) {
    // The same row visibility as GET /api/users/:id: 404 when invisible or missing, 403 when objectLevel refuses
    const user = await findAuthorizedRow(ctx, 'users', ctx.params.id)

    const [[postStats], [commentStats]] = await Promise.all([
      ctx.db.select({ count: count() }).from(posts).where(eq(posts.userId, user.id)),
      ctx.db.select({ count: count() }).from(comments).where(eq(comments.userId, user.id))
    ])

    // The response is filtered like GET /api/users/:id: hidden fields (password, apiKey) and the fields the caller
    // may not read (email) are removed for you
    return {
      ...user,
      stats: {
        postCount: postStats!.count,
        commentCount: commentStats!.count
      }
    }
  }
})
