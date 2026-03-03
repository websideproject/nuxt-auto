import { useDB } from '../../database/db'

export default defineEventHandler(async (event) => {
  const db = useDB()
  // limit to 20 to match default pagination
  const result = await db.query.posts.findMany({
    limit: 20,
    with: {
      author: true,
      comments: true,
    }
  })
  return result
})
