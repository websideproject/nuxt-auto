import { defineEventHandler, readBody, setCookie } from 'h3'

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
    email: 'admin@example.com',
    role: 'admin',
  },
  editor: {
    id: 2,
    name: 'Editor User',
    email: 'editor@example.com',
    role: 'editor',
  },
  user: {
    id: 3,
    name: 'Regular User',
    email: 'user@example.com',
    role: 'user',
  },
}

/**
 * POST /api/demo/session
 * Set demo user session
 * Body: { role: 'admin' | 'editor' | 'user' | 'anonymous' }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ role: string }>(event)

  if (body.role === 'anonymous') {
    // Clear the session
    setCookie(event, 'demo-session', '', {
      maxAge: 0,
      path: '/',
    })
    return { user: null }
  }

  const user = DEMO_USERS[body.role]

  if (!user) {
    throw createError({
      statusCode: 400,
      message: `Invalid role: ${body.role}`,
    })
  }

  // Set session cookie
  setCookie(event, 'demo-session', body.role, {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    httpOnly: false, // Allow client-side access for demo purposes
    sameSite: 'lax',
  })

  return { user }
})
