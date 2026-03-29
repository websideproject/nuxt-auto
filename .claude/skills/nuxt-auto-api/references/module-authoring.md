# Module Authoring with nuxt-auto-api

Building a reusable Nuxt module that registers resources into `nuxt-auto-api`.

---

## How It Works

nuxt-auto-api exposes a build-time hook `autoApi:registerSchema` that fires after all modules have loaded. Your module hooks into it to register Drizzle table schemas. After all registrations, nuxt-auto-api generates a virtual registry module and wires up HTTP handlers automatically.

**Registration timing:** The hook runs at `modules:done`. Never try to register resources in `setup()` directly — always use the hook.

---

## Directory Structure

```
modules/blog/
├── module.ts              # defineNuxtModule — hooks into autoApi:registerSchema
├── schema.ts              # Drizzle table definitions (exported by name)
├── auth.ts                # ResourceAuthConfig exports (co-located)
├── hooks.ts               # ResourceHooks exports (optional, co-located)
└── runtime/
    └── server/
        └── database/
            └── migrations/   # Drizzle migration files
```

---

## The Core Pattern

```ts
// module.ts
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

export default defineNuxtModule({
  meta: {
    name: '@myorg/module-blog',
    configKey: 'moduleBlog',
  },

  setup(_options, nuxt: Nuxt) {
    const resolver = createResolver(import.meta.url)

    // Register resources into nuxt-auto-api
    nuxt.hook('autoApi:registerSchema' as any, (registry: any) => {
      registry.register('posts', {
        schema: createModuleImport(resolver.resolve('./schema'), 'posts'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'postsAuth'),
        hooks: createModuleImport(resolver.resolve('./hooks'), 'postsHooks'),
      })

      // Junction table — register but mark as hidden in admin
      registry.register('postTags', {
        schema: createModuleImport(resolver.resolve('./schema'), 'postTags'),
      })
    })

    // Optionally configure nuxt-auto-admin if it's present
    if ((nuxt.options as any).autoAdmin) {
      (nuxt.options as any).autoAdmin = {
        ...(nuxt.options as any).autoAdmin,
        resources: {
          posts: {
            displayName: 'Blog Posts',
            icon: 'i-heroicons-document-text',
            group: 'Content',
            order: 1,
            listFields: ['title', 'status', 'authorId', 'createdAt'],
            hiddenFields: ['deletedAt'],
          },
          postTags: { type: 'junction' },  // hide from sidebar
          // Spread host app's resources AFTER ours so they can override
          ...((nuxt.options as any).autoAdmin.resources ?? {}),
        },
      }
    }
  },
})
```

---

## `createModuleImport`

Creates a **deferred import reference** that nuxt-auto-api resolves during virtual module generation. This avoids circular dependencies at module setup time.

```ts
import { createModuleImport } from '@websideproject/nuxt-auto-api'

createModuleImport(
  resolver.resolve('./schema'),   // absolute path to the file
  'posts'                         // named export to import from that file
)
// → { __modulePath: '/abs/path/schema', __exportName: 'posts', __isModuleImport: true }
```

**Important:** Always use `resolver.resolve()` (from `createResolver(import.meta.url)`) to get an absolute path. Never pass relative paths.

---

## Schema File (`schema.ts`)

Standard Drizzle table definitions. Export each table by name — this name must match the `__exportName` in `createModuleImport`.

```ts
// schema.ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const posts = sqliteTable('posts', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  title:       text('title').notNull(),
  slug:        text('slug').unique(),
  content:     text('content'),
  status:      text('status', { enum: ['draft', 'published', 'archived'] }).default('draft'),
  authorId:    integer('author_id'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt:   integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }),
  deletedAt:   integer('deleted_at', { mode: 'timestamp' }),  // enables soft-delete
})

export const tags = sqliteTable('tags', {
  id:   integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

// Junction table — composite PK enables M2M auto-detection
export const postTags = sqliteTable('post_tags', {
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  tagId:  integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  order:  integer('order').default(0),   // optional metadata column
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.tagId] }),
}))

// Drizzle relations (used for include: [] queries)
export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  postTags: many(postTags),
}))

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag:  one(tags,  { fields: [postTags.tagId],  references: [tags.id] }),
}))
```

**Junction table rules for M2M auto-detection:**
- Exactly two foreign key columns
- Composite `primaryKey` on both FK columns
- Any additional columns become `metadataColumns`

---

## Authorization File (`auth.ts`)

```ts
// auth.ts
import { eq } from 'drizzle-orm'
import type { ResourceAuthConfig } from '@websideproject/nuxt-auto-api'

export const postsAuth: ResourceAuthConfig = {
  // Operation-level guards
  permissions: {
    read:   () => true,                                  // public read
    create: ['editor', 'admin'],                         // roles
    update: (ctx) => ctx.user?.roles?.includes('editor') || ctx.user?.roles?.includes('admin'),
    delete: 'admin',
  },

  // SQL WHERE filter — applied before query (correct pagination, efficient)
  listFilter: (table, ctx) => {
    const isEditor = ctx.user?.roles?.some(r => ['editor', 'admin'].includes(r))
    if (isEditor) return undefined  // no filter for editors
    return eq(table.status, 'published')
  },

  // Object-level — applied per item after fetch (use for ownership checks)
  objectLevel: async (post, ctx) => {
    if (ctx.user?.roles?.includes('admin')) return true
    if (ctx.operation === 'get') return post.status === 'published'
    // For update/delete: only the author
    return post.authorId === ctx.user?.id
  },

  // Field-level guards
  fields: {
    internalNotes: {
      read:  (ctx) => ctx.user?.roles?.includes('admin'),
      write: (ctx) => ctx.user?.roles?.includes('admin'),
    },
  },
}
```

---

## Hooks File (`hooks.ts`)

```ts
// hooks.ts
import type { ResourceHooks } from '@websideproject/nuxt-auto-api'
import { generateSlug } from '../utils/slug'

export const postsHooks: ResourceHooks = {
  beforeCreate: async (data, ctx) => {
    data.authorId = ctx.user!.id
    data.slug = data.slug || generateSlug(data.title)
    data.createdAt = new Date()
    return data
  },

  beforeUpdate: async (id, data, ctx) => {
    data.updatedAt = new Date()
    return data
  },

  afterCreate: async (result, ctx) => {
    // Side effects: notifications, search indexing, etc.
    await notifySubscribers(result.id)
    return result
  },

  beforeDelete: async (id, ctx) => {
    // Cleanup before deletion
    await cleanupPostAssets(id)
  },
}
```

---

## Plugin Registration Hook

For runtime extensions (middleware, global hooks), use `autoApi:registerPlugins`:

```ts
nuxt.hook('autoApi:registerPlugins' as any, (ctx: any) => {
  ctx.addGlobalHook({
    beforeCreate: (data, handlerCtx) => {
      // Runs for ALL resources in this module's app
      data.tenantId = handlerCtx.tenant?.id
      return data
    },
  })
})
```

---

## TypeScript: Augmenting the Hook Type

Avoid the `as any` casts by augmenting `@nuxt/schema`:

```ts
// types/nuxt.d.ts (in your module)
import type { BuildTimeRegistry } from '@websideproject/nuxt-auto-api'

declare module '@nuxt/schema' {
  interface NuxtHooks {
    'autoApi:registerSchema': (registry: BuildTimeRegistry) => void | Promise<void>
  }
}
```

Then use without cast:
```ts
nuxt.hook('autoApi:registerSchema', (registry) => {
  registry.register('posts', { ... })
})
```

---

## `BuildTimeRegistry` Interface

```ts
interface BuildTimeRegistry {
  resources: Map<string, ResourceRegistration>
  register(name: string, config: Omit<ResourceRegistration, 'name'>): void
  getAll(): ResourceRegistration[]
}

interface ResourceRegistration {
  name: string
  schema: any                          // createModuleImport reference at build time
  authorization?: ResourceAuthConfig | any
  validation?: any
  hooks?: ResourceHooks | any
  metadata?: Record<string, any>
  hiddenFields?: string[]
}
```

---

## Configuring nuxt-auto-admin from a Module

If the host app has `@websideproject/nuxt-auto-admin` installed, the module can inject resource display config:

```ts
setup(_options, nuxt) {
  // Guard: only configure admin if it's present
  if ((nuxt.options as any).autoAdmin) {
    (nuxt.options as any).autoAdmin = {
      ...(nuxt.options as any).autoAdmin,
      resources: {
        // Your resource defaults
        posts: {
          displayName: 'Blog Posts',
          icon: 'i-heroicons-document-text',
          group: 'Content',
          listFields: ['title', 'status', 'createdAt'],
          readonlyFields: ['createdAt', 'updatedAt', 'slug'],
        },
        // Spread host config LAST so it can override your defaults
        ...((nuxt.options as any).autoAdmin.resources ?? {}),
      },
    }
  }
}
```
