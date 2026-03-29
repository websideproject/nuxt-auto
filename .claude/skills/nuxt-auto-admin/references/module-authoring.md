# Module Authoring with nuxt-auto-admin

How to configure nuxt-auto-admin from inside a reusable Nuxt module that ships its own resources.

**Prerequisite:** The module must also use `nuxt-auto-api` (see its `module-authoring.md`). nuxt-auto-admin consumes the same registry populated by `autoApi:registerSchema`.

---

## How It Works

nuxt-auto-admin **captures the registry reference** during the same `autoApi:registerSchema` hook that nuxt-auto-api uses. After `modules:done`, it introspects every registered Drizzle table and builds an admin schema (columns, relations, form fields, list columns) automatically.

Modules can inject **display-layer config** (labels, icons, groups, form field overrides) by mutating `nuxt.options.autoAdmin.resources` during module setup.

---

## The Injection Pattern

Always guard the injection since the host app may not have nuxt-auto-admin installed:

```ts
// module.ts
export default defineNuxtModule({
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // 1. Register schema with nuxt-auto-api (always required)
    nuxt.hook('autoApi:registerSchema' as any, (registry: any) => {
      registry.register('posts', {
        schema: createModuleImport(resolver.resolve('./schema'), 'posts'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'postsAuth'),
      })
      registry.register('postTags', {
        schema: createModuleImport(resolver.resolve('./schema'), 'postTags'),
      })
    })

    // 2. Inject admin display config if nuxt-auto-admin is present
    if ((nuxt.options as any).autoAdmin) {
      (nuxt.options as any).autoAdmin = {
        ...(nuxt.options as any).autoAdmin,
        resources: {
          // Module's default config — host app spreads AFTER to override
          posts: {
            displayName: 'Blog Posts',
            icon: 'i-heroicons-document-text',
            group: 'Content',
            order: 1,
            listFields: ['title', 'status', 'authorId', 'publishedAt', 'createdAt'],
            hiddenFields: ['deletedAt', 'internalScore'],
            readonlyFields: ['createdAt', 'updatedAt', 'slug'],
            formFields: {
              create: [
                { name: 'title',    label: 'Title',   widget: 'TextInput',     required: true },
                { name: 'slug',     label: 'Slug',    widget: 'SlugInput',
                  options: { generateFrom: 'title' } },
                { name: 'content',  label: 'Content', widget: 'MarkdownEditor' },
                { name: 'status',   label: 'Status',  widget: 'SelectInput',
                  options: { enumValues: ['draft', 'published', 'archived'] } },
                { name: 'authorId', label: 'Author',  widget: 'RelationSelect',
                  options: { resource: 'users', displayField: 'name', searchFields: ['name', 'email'] } },
                { name: 'tags',     label: 'Tags',    widget: 'MultiRelationSelect',
                  options: { resource: 'tags', displayField: 'name',
                    junctionTable: 'postTags', junctionLeftKey: 'postId', junctionRightKey: 'tagId' } },
              ],
              edit: [
                { name: 'title',   label: 'Title',   widget: 'TextInput',     required: true },
                { name: 'content', label: 'Content', widget: 'MarkdownEditor' },
                { name: 'status',  label: 'Status',  widget: 'SelectInput',
                  options: { enumValues: ['draft', 'published', 'archived'] } },
                { name: 'tags',    label: 'Tags',    widget: 'MultiRelationSelect',
                  options: { resource: 'tags', displayField: 'name',
                    junctionTable: 'postTags', junctionLeftKey: 'postId', junctionRightKey: 'tagId' } },
              ],
            },
          },

          // Junction table: hide from admin sidebar
          postTags: { type: 'junction' },

          // Spread host app config LAST — lets it override anything above
          ...((nuxt.options as any).autoAdmin.resources ?? {}),
        },
      }
    }
  },
})
```

---

## Spread Order Matters

```ts
resources: {
  // 1. Module defaults (your safe fallbacks)
  posts: { displayName: 'Blog Posts', icon: '...' },

  // 2. Host app overrides (spread last — wins over module defaults)
  ...((nuxt.options as any).autoAdmin.resources ?? {}),
}
```

This lets the host app customize anything your module sets by putting config in their `nuxt.config.ts`:

```ts
// host app nuxt.config.ts
autoAdmin: {
  resources: {
    posts: {
      displayName: 'Articles',  // overrides module's 'Blog Posts'
      group: 'Editorial',
    },
  },
}
```

---

## ResourceConfig Reference (in module context)

```ts
interface ResourceConfig {
  displayName?: string             // Label shown in sidebar and page headers
  icon?: string                    // Iconify icon
  group?: string                   // Sidebar group label
  order?: number                   // Sort order within the group
  type?: 'resource' | 'junction'  // 'junction' = hidden from sidebar

  listFields?: string[]            // Which columns appear in the table view
  hiddenFields?: string[]          // Excluded from list AND form
  readonlyFields?: string[]        // Shown in forms but not editable

  formFields?: {
    create?: FieldConfig[]
    edit?: FieldConfig[]
  }

  actions?: Record<string, CustomAction>
  disabled?: boolean               // Hide resource entirely
}
```

---

## Auto-Introspection

Even without `formFields` config, nuxt-auto-admin introspects every registered Drizzle table at build time using `Symbol.for('drizzle:Columns')` to read column metadata. It auto-selects widgets based on:

| Column pattern | Auto widget |
|----------------|-------------|
| `*Id` (FK) | `RelationSelect` (targets guessed from resource name) |
| Enum column | `SelectInput` with enum values |
| `password`, `*hash*`, `*secret*` | `PasswordInput` |
| Boolean | `CheckboxInput` |
| Integer/numeric | `NumberInput` |
| Date/timestamp | `DateTimePicker` |
| Large text, `*content*`, `*body*` | `TextareaInput` |
| JSON | `JsonEditor` |
| Default | `TextInput` |

The `formFields` config in your module is used to **override** this auto-detection — useful for:
- Setting M2M `MultiRelationSelect` fields (not auto-detected for FK-less junction)
- Using `MarkdownEditor` instead of `TextareaInput`
- Specifying `RelationSelect.displayField` and `searchFields`
- Adding `SlugInput` with `generateFrom`
- Ordering fields explicitly

---

## Custom Actions from a Module

```ts
if ((nuxt.options as any).autoAdmin) {
  (nuxt.options as any).autoAdmin = {
    ...(nuxt.options as any).autoAdmin,
    resources: {
      posts: {
        ...,
        actions: {
          publish: {
            label: 'Publish',
            icon: 'i-heroicons-paper-airplane',
            type: 'single',
            location: 'row',
            permission: (ctx) => ctx.user?.roles?.includes('editor'),
            confirm: (item) => `Publish "${item.title}"?`,
            handler: async (item, ctx) => {
              await $fetch(`/api/posts/${item.id}`, {
                method: 'PATCH',
                body: { status: 'published', publishedAt: new Date() },
              })
              await ctx.refresh()
            },
          },
        },
      },
      ...((nuxt.options as any).autoAdmin.resources ?? {}),
    },
  }
}
```

---

## Detecting Admin Presence

```ts
// Robust check — works even if autoAdmin key was set but not initialized
const hasAdmin = !!(nuxt.options as any).autoAdmin
  || nuxt.options.modules?.some(m => String(m).includes('nuxt-auto-admin'))
```

---

## Full Module Checklist

1. `autoApi:registerSchema` hook → register all tables (including junction tables)
2. Guard `if (nuxt.options.autoAdmin)` before injecting display config
3. Mark junction tables as `type: 'junction'`
4. Define `formFields.create` and `formFields.edit` for non-trivial resources
5. Spread `...((nuxt.options as any).autoAdmin.resources ?? {})` LAST
6. Export `ResourceConfig` types if the module has a public API
