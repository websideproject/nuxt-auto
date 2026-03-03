import type { ResourceAuthConfig } from '../../../packages/nuxt-auto-api/src/runtime/types'

/**
 * Authorization configuration for core playground resources
 */

// Users resource
export const usersAuth: ResourceAuthConfig = {
  permissions: {
    // Anyone can read users
    // read: () => true, // (context) => !!context.user,
    read: (context) => !!context.user,
    // Only admins can create users
    create: 'admin',
    // Users can update themselves, admins can update anyone
    update: (context) => {
      if (context.permissions.includes('admin')) return true
      if (context.user && context.params.id === String(context.user.id)) return true
      return false
    },
    // Only admins can delete users
    delete: 'admin',
  },
  // Object-level check: users can only see/edit themselves unless they're admin
  objectLevel: async (object, context) => {
    if (context.permissions.includes('admin')) return true
    // Convert both to string for comparison since IDs might be different types
    if (context.user && String(object.id) === String(context.user.id)) return true
    return false
  },
  // Field-level permissions
  fields: {
    // Only the user themselves or admins can see the email
    email: {
      read: (context) => {
        if (context.permissions.includes('admin')) return true
        if (context.user && context.params.id === String(context.user.id)) return true
        return false
      },
    },
    // Only admins can change role
    role: {
      write: 'admin',
    },
  },
}

// Posts resource - object-level authorization demo
export const postsAuth: ResourceAuthConfig = {
  permissions: {
    // Anyone can read posts
    read: () => true,
    // Authenticated users can create posts
    create: (context) => !!context.user,
    // Authenticated users can update (but object-level auth will restrict to own posts)
    update: (context) => !!context.user,
    // Authenticated users can delete (but object-level auth will restrict to own posts)
    delete: (context) => !!context.user,
  },
  // Object-level: users can only edit their own posts unless they're admin
  objectLevel: async (object, context) => {
    // Allow reading all posts
    if (context.operation === 'get' || context.operation === 'list') return true

    // Admins can do anything
    if (context.user?.role === 'admin') return true

    // For update/delete, must be the owner
    if (context.operation === 'update' || context.operation === 'delete') {
      return context.user && String(object.userId) === String(context.user.id)
    }

    return false
  },
}

// Comments resource
export const commentsAuth: ResourceAuthConfig = {
  permissions: {
    read: () => true,
    create: (context) => !!context.user,
    update: (context) => !!context.user,
    delete: ['admin', 'editor'],
  },
}
