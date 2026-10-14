import { createApiTokenPlugin } from '@websideproject/nuxt-auto-api/plugins'

export default [
  createApiTokenPlugin({
    resources: { apiKeys: { scopeField: 'scopes', hintField: 'keyHint' } },
    auth: { tokenPrefix: 'sk_' },
    mapUser: (row: any) => ({ id: row.id, email: row.email, organizationId: row.organizationId }),
    getPermissions: () => ['labels:read'],
  }),
]
