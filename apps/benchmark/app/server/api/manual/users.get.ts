import { useDB } from '../../database/db'
import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const db = useDB()
  const result = await db.select().from(users).all()
  return result
})
