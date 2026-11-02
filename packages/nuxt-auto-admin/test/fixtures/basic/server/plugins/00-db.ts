import { defineNitroPlugin } from 'nitropack/runtime'
import { useDB } from '../database/db'

export default defineNitroPlugin(() => {
  const db = useDB()
  initializeDatabase(db, 'better-sqlite3')
})
