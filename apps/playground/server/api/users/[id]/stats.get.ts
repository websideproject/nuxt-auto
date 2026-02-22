import { eq, count } from 'drizzle-orm'
import { users, posts, comments } from '../../../database/schema'
import { createError } from 'h3'

/**
 * Custom endpoint using createEndpoint (auto-imported).
 * Demonstrates: resource-bound endpoint, full pipeline, custom logic.
 */
export default createEndpoint({
  resource: 'users',
  operation: 'get',

  async handler(ctx) {
    const userId = parseInt(ctx.params.id)

    if (isNaN(userId)) {
      throw createError({ statusCode: 400, message: 'Invalid user ID' })
    }

    // Custom query logic - fetch user and stats in parallel
    const [user, postStats, commentStats] = await Promise.all([
      ctx.db.query.users.findFirst({
        where: eq(users.id, userId),
      }),
      ctx.db
        .select({ count: count() })
        .from(posts)
        .where(eq(posts.userId, userId)),
      ctx.db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.userId, userId)),
    ])

    if (!user) {
      throw createError({ statusCode: 404, message: 'User not found' })
    }

    return {
      ...user,
      stats: {
        postCount: postStats[0].count,
        commentCount: commentStats[0].count,
      },
    }
  },
})
