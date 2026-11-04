import { posts } from '../../../../database/schema'

/**
 * Recipe: the row rule decides. `scope: 'update'` asks the same two rules as PATCH /api/posts/:id: `permissions.update`
 * for the person, then `objectLevel` for this row, so an author can take back only their own post (403 otherwise).
 */
export default createEndpoint({
  resource: 'posts',
  scope: 'update',
  row: 'id',
  refusal: 'You can only unpublish your own posts.',

  handler: ctx => updateReturning(ctx.db, posts, ctx.row.id, { published: false, updatedAt: new Date() })
})
