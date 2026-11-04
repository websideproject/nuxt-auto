import { posts } from '../../../../database/schema'

/**
 * Recipe: an action of its own. `scope: 'publish'` asks `postsAuth.permissions.publish` (editors and admins), `row: 'id'`
 * loads the post into `ctx.row` (404 when it's missing or hidden), and `refusal` is what everyone else is told.
 */
export default createEndpoint({
  resource: 'posts',
  scope: 'publish',
  row: 'id',
  refusal: 'Only editors and admins publish posts.',

  handler: ctx => updateReturning(ctx.db, posts, ctx.row.id, { published: true, updatedAt: new Date() })
})
