import { FastifyInstance } from 'fastify'
import { useDB } from '../database/db.js'
import { users } from '../database/schema.js'

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const db = useDB()
    const result = await db.select().from(users).all()
    return result
  })
}
