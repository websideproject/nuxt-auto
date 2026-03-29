# Configuration Reference

## Full Module Options

```ts
// nuxt.config.ts
autoAdmin: {
  prefix?: string                      // default: '/admin'

  // Who can access the admin panel at all
  access?: (user: any) => boolean | Promise<boolean>

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
    bulkActions?: boolean              // default: true
    search?: boolean                   // default: true
    filters?: boolean                  // default: true
    export?: boolean                   // default: true
    import?: boolean                   // default: false
    auditLog?: boolean                 // default: false
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

  actions?: Record<string, CustomAction>   // Custom per-item, bulk, or page-level actions

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
  permissions?: string | string[]
  canAccess?: (user: any) => boolean | Promise<boolean>
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
    canAccess: (user) => user?.roles?.includes('analyst'),
  },
]
```

The corresponding page component should be created at `pages/admin/analytics.vue`.

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
