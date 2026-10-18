// `import type` only: this file is loaded through the resource registry (createModuleImport), where relative runtime
// imports do not resolve.
import type { ResourceHooks } from '../../../packages/nuxt-auto-api/src/runtime/types'

/**
 * Lifecycle hooks of `posts`, shown live on /demo/hooks. Each call is written to an in-memory log of the server
 * process (`GET /api/demo/hook-log` reads it) — enough for a demo; a real app would log or send events.
 */
export interface HookLogEntry {
  hook: string
  message: string
  type: 'before' | 'after' | 'error'
  timestamp: string
  user: string
}

declare global {
  var __playgroundHookLog: HookLogEntry[] | undefined
}

function log(hook: string, message: string, context: { user?: { name?: string, id?: unknown } | null }) {
  const entries = (globalThis.__playgroundHookLog ??= [])
  entries.unshift({
    hook,
    message,
    type: hook.startsWith('before') ? 'before' : 'after',
    timestamp: new Date().toISOString(),
    user: context.user?.name ?? (context.user?.id != null ? `user ${context.user.id}` : 'anonymous')
  })
  entries.length = Math.min(entries.length, 50)
}

export const postsHooks: ResourceHooks = {
  // before* may change the data (return it) or refuse the request (throw)
  beforeCreate(data, context) {
    const original = String(data.title ?? '')
    // Collapse runs of whitespace and capitalize the first letter
    const title = original.trim().replace(/\s+/g, ' ').replace(/^./, c => c.toUpperCase())
    log('beforeCreate', title === original ? `Title "${title}" kept as it is` : `Title "${original}" → "${title}"`, context)
    return { ...data, title }
  },
  afterCreate(post, context) {
    log('afterCreate', `Post #${post.id} created`, context)
  },
  beforeUpdate(id, data, context) {
    log('beforeUpdate', `Updating post #${id}: ${Object.keys(data).join(', ') || 'no fields'}`, context)
    return data
  },
  afterUpdate(post, context) {
    log('afterUpdate', `Post #${post.id} saved — "${post.title}"`, context)
  },
  beforeDelete(id, context) {
    log('beforeDelete', `Deleting post #${id} (the authorization rules already passed)`, context)
  },
  afterDelete(id, context) {
    log('afterDelete', `Post #${id} deleted`, context)
  },
  afterList(posts, context) {
    log('afterList', `Listed ${posts.length} posts`, context)
  }
}
