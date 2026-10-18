import { count } from 'drizzle-orm'
import { posts } from '../../database/schema'

/**
 * Recipe: aggregate over exactly the rows the caller may see. `rowScope` is the visibility the list applies
 * (tenant, `listFilter`, soft delete) as one SQL condition, so a custom query cannot count past it.
 */
export default createEndpoint({
  resource: 'posts',
  operation: 'list', // gated by posts' `read` permission

  async handler(ctx) {
    const rows = await ctx.db
      .select({ published: posts.published, count: count() })
      .from(posts)
      .where(rowScope(ctx, 'posts', posts))
      .groupBy(posts.published)
    const total = (published: boolean) => Number(rows.find(r => Boolean(r.published) === published)?.count ?? 0)
    return { published: total(true), drafts: total(false) }
  }
})
