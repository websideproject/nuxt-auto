import { defineEventHandler, deleteCookie } from 'h3'

/**
 * DELETE /api/demo/session
 * Clear demo session (logout)
 */
export default defineEventHandler((event) => {
  deleteCookie(event, 'demo-session')

  return { success: true }
})
