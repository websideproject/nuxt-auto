// A POST that only reads: `scope: 'read'` is posts' read rule, not its (undeclared, so closed) create rule.
import { posts } from '../../database/schema'

export default createEndpoint({
  resource: 'posts',
  scope: 'read',
  handler: async ctx => ctx.db.select().from(posts).where(rowScope(ctx, 'posts', posts)),
})
