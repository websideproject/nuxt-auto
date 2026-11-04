import { count } from 'drizzle-orm'
import { posts, users } from '../../database/schema'

/**
 * Recipe: a permission that belongs to no resource. A `scope` with a colon names the whole string, here one only admins
 * hold (server/plugins/auth.ts). With no `resource`, it's the only form of `scope` there is.
 */
export default createEndpoint({
  scope: 'reports:export',
  refusal: 'Only admins export reports.',

  async handler(ctx) {
    const [[people], [written]] = await Promise.all([
      ctx.db.select({ total: count() }).from(users),
      ctx.db.select({ total: count() }).from(posts)
    ])
    return { users: people!.total, posts: written!.total }
  }
})
