// A permission from outside the resource: a string with a colon names all of it.
export default createEndpoint({
  resource: 'posts',
  scope: 'labels:read',
  handler: async () => ({ ok: true }),
})
