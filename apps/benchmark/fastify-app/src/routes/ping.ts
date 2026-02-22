import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    return { ping: 'pong' }
  })
}
