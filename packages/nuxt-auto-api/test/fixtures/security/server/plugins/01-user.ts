import { defineNitroPlugin } from 'nitropack/runtime'
import { getHeader } from 'h3'

// Test-only auth: `x-test-user` picks an identity (what an app's own auth middleware does).
const USERS: Record<string, any> = {
  alice: { id: 1, organizationId: 'org_a', permissions: ['posts:update', 'users:read', 'labels:read'] },
  // Signed in, no active organization (better-auth: activeOrganizationId = null).
  noorg: { id: 3, organizationId: null, permissions: ['users:read'] },
  // An auth layer that puts no organizationId on the user at all.
  bare: { id: 4, permissions: [] },
  root: { id: 5, organizationId: 'org_a', permissions: ['*'] },
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const who = getHeader(event, 'x-test-user')
    if (who && USERS[who]) {
      event.context.user = USERS[who]
      event.context.permissions = USERS[who].permissions
    }
  })
})
