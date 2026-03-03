import { defineNitroPlugin } from 'nitropack/runtime'
import { useDB } from '../database/db'

/**
 * Initialize database for auto-api using the adapter system.
 * This replaces the legacy `globalThis.__autoApiDb` pattern.
 */
export default defineNitroPlugin(() => {
  const db = useDB()

  // Initialize with the adapter system (also sets legacy globalThis.__autoApiDb for compat)
  initializeDatabase(db, 'better-sqlite3')

  console.log('[playground] Database initialized with better-sqlite3 adapter')
})
