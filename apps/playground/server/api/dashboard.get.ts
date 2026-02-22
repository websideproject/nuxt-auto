import { count } from 'drizzle-orm'
import { users, posts, comments } from '../database/schema'

/**
 * Standalone endpoint using auto-imported helpers.
 * Demonstrates: getAutoApiContext, respondWith (no resource binding needed).
 */
export default defineEventHandler(async (event) => {
  const ctx = await getAutoApiContext(event)

  const [userCount, postCount, commentCount] = await Promise.all([
    ctx.db.select({ count: count() }).from(users),
    ctx.db.select({ count: count() }).from(posts),
    ctx.db.select({ count: count() }).from(comments),
  ])

  return respondWith({
    users: userCount[0].count,
    posts: postCount[0].count,
    comments: commentCount[0].count,
    database: ctx.adapter?.engine || 'unknown',
  })
})
