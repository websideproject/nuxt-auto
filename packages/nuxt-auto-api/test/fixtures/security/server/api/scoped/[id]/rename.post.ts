// `scope` is the permission, `row` the row the route names: no permission or lookup code in the handler.
export default createEndpoint({
  resource: 'posts',
  scope: 'update',
  row: 'id',
  refusal: 'Only editors rename posts.',
  handler: async ctx => ({ title: ctx.row.title, id: ctx.row.id }),
})
