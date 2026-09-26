import { defineNitroPlugin } from 'nitropack/runtime'
import { initializeDatabase } from '@websideproject/nuxt-auto-api/database'
import { useDB } from '../database/db'

/**
 * Initialize the database for auto-api.
 */
export default defineNitroPlugin(() => {
  initializeDatabase(useDB(), 'better-sqlite3')

  console.log('[benchmark] Database initialized for auto-api')
})
