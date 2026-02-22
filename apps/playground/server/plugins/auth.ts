import { defineNitroPlugin } from 'nitropack/runtime'
import { getHeader, getCookie } from 'h3'

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
 * Enhanced authentication plugin with demo session support
 * Priority:
 * 1. Check demo-session cookie (for interactive demo)
 * 2. Check Authorization header (for API testing)
 */
export default defineNitroPlugin((nitroApp) => {
  // Add authentication hook
  nitroApp.hooks.hook('request', async (event) => {
    // Skip authentication for non-API routes
    if (!event.path.startsWith('/api/')) {
      return
    }

    // Priority 1: Check for demo session cookie
    const demoSession = getCookie(event, 'demo-session')

    if (demoSession && DEMO_USERS[demoSession]) {
      const demoUser = DEMO_USERS[demoSession]
      event.context.user = {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        roles: [demoUser.role],
      }

      // Set permissions based on role
      // The permissions array should contain role names that match the auth configs
      if (demoUser.role === 'admin') {
        event.context.permissions = ['admin']
      }
      else if (demoUser.role === 'editor') {
        event.context.permissions = ['editor']
      }
      else {
        event.context.permissions = ['user']
      }

      console.log('[auth] Demo user authenticated:', event.context.user.email, event.context.user.role)
      return
    }

    // Priority 2: Check for Authorization header (fallback for API testing)
    // Skip tokens with sk_ prefix — those are handled by the API Token plugin
    const authHeader = getHeader(event, 'Authorization')

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')

      // Let the API Token plugin handle sk_ prefixed tokens
      if (token.startsWith('sk_')) {
        return
      }

      // For demo purposes, we'll use a simple format: "Bearer user:role:permissions"
      const [userId, role, ...permissions] = token.split(':')

      if (userId && role) {
        event.context.user = {
          id: userId,
          role,
          permissions: permissions || [],
        }

        console.log('[auth] Token authenticated user:', event.context.user)
      }
    }

    // If no auth method found, user is anonymous (null)
    // The API will still work, but authorization might restrict access
  })
})
