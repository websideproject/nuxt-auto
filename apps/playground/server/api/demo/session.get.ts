import { defineEventHandler, getCookie } from 'h3'

interface DemoUser {
  id: number
  name: string
  email: string
  role: string
}

const DEMO_USERS: Record<string, DemoUser> = {
  admin: {
    id: 1,
    name: 'Admin User',
    email: 'admin@playground.test',
    role: 'admin'
  },
  editor: {
    id: 2,
    name: 'Editor User',
    email: 'editor@playground.test',
    role: 'editor'
  },
  user: {
    id: 3,
    name: 'Regular User',
    email: 'user@playground.test',
    role: 'user'
  }
}

/**
 * GET /api/demo/session
 * Returns current demo session user
 */
export default defineEventHandler((event) => {
  const sessionCookie = getCookie(event, 'demo-session')

  if (!sessionCookie) {
    return { user: null }
  }

  const user = DEMO_USERS[sessionCookie]

  if (!user) {
    return { user: null }
  }

  return { user }
})
