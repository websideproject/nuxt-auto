import { defineNitroPlugin } from 'nitropack/runtime'
import { useDB } from '../database/db'
import { initializeDatabase } from '@websideproject/nuxt-auto-api/database'

export default defineNitroPlugin(() => {
  initializeDatabase(useDB(), 'better-sqlite3')
})
