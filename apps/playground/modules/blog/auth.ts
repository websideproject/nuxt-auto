import { eq } from 'drizzle-orm'
import type { ResourceAuthConfig } from '../../../packages/nuxt-auto-api/src/runtime/types'

/**
 * Authorization configuration for articles
 * - Anyone can read published articles
 * - Only editors and admins can create/update articles
 * - Admins can do anything
 */
export const articlesAuth: ResourceAuthConfig = {
  permissions: {
    read: () => true, // Public read access
    create: ['editor', 'admin'], // Only editors and admins can create
    update: ['editor', 'admin'], // Only editors and admins can update
    delete: 'admin', // Only admins can delete

    // M2M relationship permissions
    m2m: {
      // Categories require update permission on the category (strict mode)
      requireUpdateOnRelated: ['categories'],

      // Custom permission checks per relation
      relations: {
        categories: {
          // Custom check: ensure user can modify this article
          check: async (ctx) => {
            // Admins can do anything
            if (ctx.user?.role === 'admin') {
              return true
            }

            // Editors can modify any article's categories
            if (ctx.user?.role === 'editor') {
              return true
            }

            // Regular users can only modify their own articles
            // Note: This would require adding authorId to articles
            // For now, just require editor role
            throw new Error('Only editors and admins can manage article categories')
          }
        },
        tags: {
          // Tags just require being authenticated (not strict)
          check: async (ctx) => {
            if (!ctx.user) {
              throw new Error('Must be authenticated to manage article tags')
            }
            return true
          }
        }
      }
    }
  },
  // SQL-level filter for list: non-editors/admins only see published articles.
  // Runs in the DB so pagination (total, limit, offset) stays correct.
  listFilter: (table, ctx) => {
    if (ctx.user?.role === 'admin' || ctx.user?.role === 'editor') return undefined
    return eq(table.published, true)
  },
  objectLevel: async (article, ctx) => {
    // Admins can do anything
    if (ctx.user?.role === 'admin') {
      return true
    }

    // For read, show published articles to everyone, drafts only to editors/admins
    if (ctx.operation === 'get' || ctx.operation === 'list') {
      if (article.published) return true
      // Drafts only visible to editors and admins
      return ctx.user?.role === 'editor' || ctx.user?.role === 'admin'
    }

    // For update/delete, must be editor or admin (already checked in permissions)
    return ctx.user?.role === 'editor' || ctx.user?.role === 'admin'
  },
}

/**
 * Authorization configuration for categories
 * - Anyone can read
 * - Only editors and admins can create/update/delete
 */
export const categoriesAuth: ResourceAuthConfig = {
  permissions: {
    read: () => true, // Public read access
    create: ['editor', 'admin'], // Must have editor or admin role
    update: ['editor', 'admin'],
    delete: 'admin', // Only admins can delete

    // M2M permissions: prevent users from linking categories they can't update
    m2m: {
      requireUpdateToLink: true, // Users must have update permission to link categories
    }
  },
}

/**
 * Authorization configuration for tags
 * - Anyone can read
 * - Authenticated users can create tags
 * - Only editors and admins can update/delete
 */
export const tagsAuth: ResourceAuthConfig = {
  permissions: {
    read: () => true, // Public read access
    create: (ctx) => !!ctx.user, // Any authenticated user can create tags
    update: ['editor', 'admin'], // Only editors/admins can update
    delete: ['editor', 'admin'], // Only editors/admins can delete
  },
}

/**
 * Authorization configuration for article-category relationships
 * - Only article authors and editors can manage
 */
export const articleCategoriesAuth: ResourceAuthConfig = {
  permissions: {
    read: () => true, // Public read access
    create: (ctx) => !!ctx.user, // Must be authenticated
    delete: (ctx) => !!ctx.user, // Must be authenticated
  },
  // Note: In a real app, you'd want to check if the user owns the article
}

/**
 * Authorization configuration for article-tag relationships
 * - Only article authors and editors can manage
 */
export const articleTagsAuth: ResourceAuthConfig = {
  permissions: {
    read: () => true, // Public read access
    create: (ctx) => !!ctx.user, // Must be authenticated
    delete: (ctx) => !!ctx.user, // Must be authenticated
  },
  // Note: In a real app, you'd want to check if the user owns the article
}
