import fastify from 'fastify'
import pingRoutes from './routes/ping.js'
import usersRoutes from './routes/users.js'
import postsRoutes from './routes/posts.js'

const server = fastify({ logger: false })

server.register(pingRoutes, { prefix: '/api/manual/ping' })
server.register(usersRoutes, { prefix: '/api/manual/users' })
server.register(postsRoutes, { prefix: '/api/manual/posts-complex' })

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Fastify server listening on http://0.0.0.0:3000')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
