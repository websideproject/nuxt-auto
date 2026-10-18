import { eq } from 'drizzle-orm'
import type { ResourceAuthConfig } from '../../../../packages/nuxt-auto-api/src/runtime/types'

/**
 * Private notes: everyone signed in may keep notes, and sees only their own. `listFilter` is SQL, so it applies to
 * every route — list, get, update, delete, restore, the trash — and another user's note is a 404.
 */
export const notesAuth: ResourceAuthConfig = {
  permissions: {
    read: ctx => !!ctx.user,
    create: ctx => !!ctx.user,
    update: ctx => !!ctx.user,
    delete: ctx => !!ctx.user
    // restore → update, viewDeleted (the trash) → restore, purge → delete: the owner has them all
  },
  listFilter: (table, ctx) => eq(table.createdBy, String(ctx.user?.id))
}
