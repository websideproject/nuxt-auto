import { defineNitroPlugin } from 'nitropack/runtime'
import { useDB } from '../database/db'
import { initializeDatabase } from '@websideproject/nuxt-auto-api/database'

export default defineNitroPlugin(() => {
  const db = useDB()
  initializeDatabase(db, 'better-sqlite3')
})
