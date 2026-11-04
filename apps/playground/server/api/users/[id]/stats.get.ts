import { eq, count } from 'drizzle-orm'
import { posts, comments } from '../../../database/schema'

/**
 * Custom endpoint using createEndpoint (auto-imported).
 * Demonstrates: `row` on a GET, and the response filtered like the generated route's.
 */
export default createEndpoint({
  resource: 'users',
  row: 'id', // the answers of GET /api/users/:id: 404 when invisible or missing, 403 when objectLevel refuses

  async handler(ctx) {
    const [[postStats], [commentStats]] = await Promise.all([
      ctx.db.select({ count: count() }).from(posts).where(eq(posts.userId, ctx.row.id)),
      ctx.db.select({ count: count() }).from(comments).where(eq(comments.userId, ctx.row.id))
    ])

    // Hidden fields (password, apiKey) and the fields the caller may not read (email) are removed for you
    return {
      ...ctx.row,
      stats: {
        postCount: postStats!.count,
        commentCount: commentStats!.count
      }
    }
  }
})
