import { FastifyInstance } from 'fastify'
import { useDB } from '../database/db.js'

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const db = useDB()
    const result = await db.query.posts.findMany({
      limit: 20,
      with: {
        author: true,
        comments: true,
      }
    })
    return result
  })
}
