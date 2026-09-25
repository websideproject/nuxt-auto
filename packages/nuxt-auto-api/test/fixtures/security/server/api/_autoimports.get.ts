// Uses the module's server auto-imports without importing them — the build fails if any registered
// auto-import cannot be resolved (which is how a broken registration surfaced in a real app).
// `defineEventHandler` is imported explicitly: Nitro 3 (Nuxt 5) no longer auto-imports h3 helpers.
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({
  createEndpoint: typeof createEndpoint,
  findAuthorizedRow: typeof findAuthorizedRow,
  evaluatePermission: typeof evaluatePermission,
}))
