// No resource: the scope still authorizes.
export default createEndpoint({
  scope: 'users:read',
  handler: async () => ({ ok: true }),
})
