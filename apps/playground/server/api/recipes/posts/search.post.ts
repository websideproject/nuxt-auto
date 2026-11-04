import { and, like } from 'drizzle-orm'
import { z } from 'zod'
import { posts } from '../../../database/schema'

/**
 * Recipe: a POST that only reads. The method alone would ask for `create`; `scope: 'read'` says what the endpoint really
 * needs, so a signed-out reader and a read-only API token (`posts:read`) may call it. `rowScope` keeps its query to what
 * the list would show.
 */
export default createEndpoint({
  resource: 'posts',
  scope: 'read',
  body: z.object({ text: z.string().min(1) }),

  handler: ctx => ctx.db.select().from(posts).where(and(like(posts.title, `%${ctx.body.text}%`), rowScope(ctx, 'posts', posts)))
})
