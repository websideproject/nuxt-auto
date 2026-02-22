import { defineNitroPlugin } from 'nitropack/runtime'
import { useDB } from '../database/db'

/**
 * Initialize database for auto-api
 * The DB instance is stored in globalThis for handlers to access
 */
export default defineNitroPlugin((nitroApp) => {
  const db = useDB()

  // Store DB in globalThis for auto-api handlers to access
  ;(globalThis as any).__autoApiDb = db

  console.log('[benchmark] Database initialized for auto-api')
})
