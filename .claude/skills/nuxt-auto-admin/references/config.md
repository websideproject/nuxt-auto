# Configuration Reference

## Full Module Options

```ts
// nuxt.config.ts
autoAdmin: {
  prefix?: string                      // default: '/admin'
  actions?: string                     // custom actions file; default app/admin.actions.ts if it exists

  // Who can open the admin at all: named route middleware (your app's middleware/auth.ts).
  // `access: (user) => …` is NOT supported — a function here never reaches the app; it fails the build.
  middleware?: string | string[]

  branding?: {
    logo?: string                      // URL to logo image
    title?: string                     // default: 'Admin Panel'
    favicon?: string
  }

  // Per-resource overrides (see ResourceConfig below)
  resources?: Record<string, ResourceConfig>

  dashboard?: DashboardConfig

  theme?: ThemeConfig

  customPages?: CustomPageConfig[]

  features?: {
    bulkActions?: boolean              // default: true  — row selection + bulk delete (canDelete)
    search?: boolean                   // default: true  — search box over the listed text columns
    filters?: boolean                  // default: true  — per-column filters
    export?: boolean                   // default: true  — CSV/JSON of the filtered list (canRead)
    import?: boolean                   // default: false — CSV → POST /bulk in batches (canCreate)
    auditLog?: boolean                 // default: false — History panel (needs createAuditLogPlugin)
  }

  permissions?: {
    unauthorizedButtons?: 'hide' | 'disable'           // default: 'disable'
    unauthorizedSidebarItems?: 'hide' | 'disable'      // default: 'hide'
  }

  ui?: {
    editMode?: 'modal' | 'page'        // default: 'modal'
    viewMode?: 'modal' | 'page'        // default: 'modal'
  }
}
```

---

## `ResourceConfig`

Overrides the auto-introspected schema for a specific resource.

```ts
interface ResourceConfig {
  displayName?: string               // Human-readable name shown in sidebar and headers
  icon?: string                      // Iconify icon (e.g. 'i-heroicons-document-text')

  listFields?: string[]              // Columns shown in the list/table view
  hiddenFields?: string[]            // Fields excluded from list + form views
  readonlyFields?: string[]          // Shown in forms but not editable

  formFields?: {
    create?: FieldConfig[]           // Override fields for create form
    edit?: FieldConfig[]             // Override fields for edit form
  }

  disabled?: boolean                 // Hide this resource from admin entirely
  group?: string                     // Sidebar group label (e.g. 'Content', 'Users')
  order?: number                     // Sort position in sidebar

  type?: 'resource' | 'junction'    // default: 'resource'; 'junction' hides from sidebar
}
```

### Example

```ts
resources: {
  posts: {
    displayName: 'Blog Posts',
    icon: 'i-heroicons-document-text',
    group: 'Content',
    order: 1,
    listFields: ['title', 'status', 'authorId', 'publishedAt', 'createdAt'],
    hiddenFields: ['deletedAt', 'internalScore'],
    readonlyFields: ['createdAt', 'updatedAt'],
    formFields: {
      create: [
        { name: 'title',    label: 'Title',   widget: 'TextInput',  required: true },
        { name: 'content',  label: 'Content', widget: 'MarkdownEditor' },
        { name: 'authorId', label: 'Author',  widget: 'RelationSelect',
          options: { resource: 'users', displayField: 'name' } },
        { name: 'status',   label: 'Status',  widget: 'SelectInput',
          options: { options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
          ]}},
      ],
    },
  },
  post_tags: { type: 'junction' },   // hide junction table from sidebar
}
```

---

## `DashboardConfig`

```ts
interface DashboardConfig {
  // Define stat cards, recent activity, or custom widgets
  widgets?: DashboardWidget[]
}
```

---

## `ThemeConfig`

```ts
interface ThemeConfig {
  // Color overrides for the admin panel (uses @nuxt/ui theming)
}
```

---

## `CustomPageConfig`

Add custom pages to the admin sidebar and routing.

```ts
interface CustomPageConfig {
  name: string                 // Route name used internally
  label: string                // Sidebar label
  path: string                 // URL path (relative to admin prefix)
  icon: string                 // Iconify icon
  group?: string               // Sidebar group
  order?: number

  // Access control
  permissions?: string | string[]   // API permissions, '<resource>:<action>' (canAccess functions fail the build)
}
```

```ts
customPages: [
  {
    name: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    icon: 'i-heroicons-chart-bar',
    group: 'Insights',
    order: 10,
    permissions: ['analytics:read'],
  },
]
```

The corresponding page component should be created at `pages/admin/analytics.vue`.

### Replacing a Resource with a Custom Admin Page

To skip auto-generation for a specific resource and build a custom page instead, combine `disabled` on the resource with a matching `customPages` entry. The underlying API endpoints remain fully functional.

```ts
autoAdmin: {
  resources: {
    orders: {
      disabled: true,  // Hides from sidebar + suppresses auto-generated CRUD routes
    },
  },
  customPages: [
    {
      name: 'orders',
      label: 'Orders',
      path: '/orders',
      icon: 'i-heroicons-shopping-cart',
      group: 'Commerce',
      order: 1,
    },
  ],
}
```

Create the page at `pages/admin/orders.vue`. You can use any nuxt-auto-admin components (`ResourceTable`, `ResourceForm`, `M2MRelationCard`) and composables (`useAdminRegistry`, `useAdminPermissions`) inside it — you just own the full layout and logic.

---

## Resource Groups

Resources with the same `group` string are grouped together in the sidebar:

```ts
resources: {
  posts:    { group: 'Content', order: 1 },
  pages:    { group: 'Content', order: 2 },
  media:    { group: 'Content', order: 3 },
  users:    { group: 'Team', order: 1 },
  roles:    { group: 'Team', order: 2 },
  settings: { group: 'System', order: 1 },
}
```

---

## Virtual Module (`#nuxt-auto-admin-registry`)

Generated at build time. Import directly for SSR-friendly registry access:

```ts
import {
  registry,
  getResource,
  getAllResources,
  getResourcesByGroup,
  resourceNames,
  adminConfig,
} from '#nuxt-auto-admin-registry'
```
