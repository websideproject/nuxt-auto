import { createRateLimitPlugin, createRequestMetadataPlugin, createApiTokenPlugin, defineAutoApiPlugin } from '@websideproject/nuxt-auto-api/plugins'
import { createHash } from 'node:crypto'

/**
 * Auto API plugins.
 *
 * This file is referenced from nuxt.config.ts via `autoApi.plugins`.
 * Export a default array of plugin instances — the module handles
 * initialization, context wiring, and lifecycle automatically.
 *
 * Because this is a real server file (not serialized from nuxt.config.ts),
 * imports like `createHash` above work naturally — no closure issues.
 */

// A simple custom plugin that uses an imported module (node:crypto)
// to prove closures and imports work in the file-based approach.
const requestFingerprintPlugin = defineAutoApiPlugin({
  name: 'request-fingerprint',
  version: '1.0.0',

  runtimeSetup(ctx) {
    // Closure variable — would break if serialized via toString()
    const seen = new Map<string, number>()

    ctx.extendContext(async (context) => {
      const ip = context.event.node?.req?.headers?.['x-forwarded-for'] || 'unknown'
      const ua = context.event.node?.req?.headers?.['user-agent'] || ''

      // Uses imported `createHash` from node:crypto — proves imports work
      const fingerprint = createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 12)

      const count = (seen.get(fingerprint) || 0) + 1
      seen.set(fingerprint, count)

      console.log(`[request-fingerprint] ${context.operation} ${context.resource} | fp=${fingerprint} seen=${count}`)
    })

    ctx.logger.info('Request fingerprint plugin initialized (closure Map + node:crypto import working)')
  },
})

export default [
  requestFingerprintPlugin,

  createRateLimitPlugin({
    windowMs: 60000,
    max: 200,
    byIp: true,
    skip: (ctx: any) => ctx.user?.role === 'admin',
  }),

  createRequestMetadataPlugin({
    autoPopulate: (metadata, data, context) => {
      if (context.operation === 'create') {
        data.signupCountry = metadata.country
        data.signupIp = metadata.ip
        data.signupMeta = {
          ip: metadata.ip,
          country: metadata.country,
          city: metadata.city,
          userAgent: metadata.userAgent,
          timestamp: new Date().toISOString(),
        }
      }

      if (context.operation === 'update') {
        data.lastIp = metadata.ip
        data.lastSeen = new Date()
      }

      return data
    },
    autoPopulateOn: ['create', 'update'],
    resources: ['users'],
  }),

  // API Token plugin — Bearer authentication + scope enforcement
  // Manages the apiKeys resource (hash on create, auth on request)
  createApiTokenPlugin({
    resources: {
      apiKeys: {
        secretField: 'key',
        userRelation: { field: 'userId', resource: 'users' },
        scopeField: 'scopes',
        expiresField: 'expiresAt',
        lastUsedField: 'lastUsedAt',
      },
    },
    auth: { tokenPrefix: 'sk_' },
    mapUser: (row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      roles: [row.role],
      permissions: row.role === 'admin' ? ['admin'] : row.role === 'editor' ? ['editor'] : [],
    }),
    getPermissions: (row: any) =>
      row.role === 'admin' ? ['admin'] : row.role === 'editor' ? ['editor'] : [],
  }),
]
