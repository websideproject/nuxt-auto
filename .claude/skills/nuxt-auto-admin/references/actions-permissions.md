# Custom Actions & Permissions

## Custom Actions

Add custom buttons to resource rows, toolbars, or detail pages.

```ts
resources: {
  posts: {
    actions: {
      publish: {
        label: 'Publish',
        icon: 'i-heroicons-paper-airplane',
        type: 'single',            // 'single' | 'bulk' | 'page-level'
        location: 'row',           // 'row' | 'toolbar' | 'detail'
        permission: (ctx) => ctx.user?.roles?.includes('editor'),
        confirm: 'Publish this post?',   // confirmation dialog message
        // or: confirm: (item) => `Publish "${item.title}"?`
        handler: async (item, ctx) => {
          await $fetch(`/api/posts/${item.id}`, {
            method: 'PATCH',
            body: { status: 'published', publishedAt: new Date() },
          })
          await ctx.refresh()
          ctx.toast.add({ title: 'Post published', color: 'success' })
        },
        variant: 'ghost',
        color: 'success',
      },
    },
  },
}
```

### `CustomAction` interface

```ts
interface CustomAction {
  label: string
  icon?: string                          // Iconify icon
  type: 'single' | 'bulk' | 'page-level'
  location: 'row' | 'toolbar' | 'detail'
  permission?: (ctx: ActionContext) => boolean | Promise<boolean>
  handler: (item: any | any[], ctx: ActionContext) => Promise<void> | void
  confirm?: string | ((item: any | any[]) => string)
  variant?: 'primary' | 'secondary' | 'ghost' | 'link'
  color?: string
}
```

### `ActionContext`

```ts
interface ActionContext {
  user: any                    // Current authenticated user
  resource: string             // Resource name
  refresh: () => Promise<void> // Re-fetch the current list/detail
  toast: any                   // @nuxt/ui useToast() instance
}
```

### Action types

| Type | Receives | Shown in |
|------|----------|----------|
| `single` | Single item | Row actions, detail page |
| `bulk` | Array of selected items | Toolbar (bulk actions) |
| `page-level` | N/A | Page toolbar only |

### Action locations

| Location | Where |
|----------|-------|
| `row` | Per-row action buttons in the table |
| `toolbar` | Above the table (for bulk and page-level) |
| `detail` | On the detail/edit page |

---

## Permission Integration

nuxt-auto-admin integrates directly with the `nuxt-auto-api` permission system.

### How permissions flow

1. `useAdminPermissions('posts')` calls `usePermissions('posts')` from nuxt-auto-api
2. The admin UI reads `canCreate`, `canRead`, `canUpdate`, `canDelete`
3. Buttons/sidebar items are **hidden or disabled** based on `autoAdmin.permissions` config

### Configure unauthorized behavior

```ts
autoAdmin: {
  permissions: {
    unauthorizedButtons: 'disable',   // 'hide' | 'disable' — default: 'disable'
    unauthorizedSidebarItems: 'hide', // 'hide' | 'disable' — default: 'hide'
  },
}
```

- `'disable'` — shows the button but makes it unclickable
- `'hide'` — removes the element entirely

### Custom action permissions

```ts
permission: async (ctx) => {
  // ctx.user is the authenticated user from the session
  return ctx.user?.roles?.includes('editor') && !ctx.user?.isSuspended
}
```

When `permission` returns `false`, the action button respects the `unauthorizedButtons` setting.

---

## Admin Access Guard

The `access` function in module config controls who can reach any admin route at all:

```ts
autoAdmin: {
  access: (user) => {
    if (!user) return false
    return user.roles?.includes('admin') || user.roles?.includes('moderator')
  },
}
```

The `admin-auth` middleware enforces this on every `/admin/*` route.

---

## Middleware

### `admin-auth`

Use in custom pages to enforce the global `access` check:

```ts
// pages/admin/custom-page.vue
definePageMeta({ middleware: 'admin-auth' })
```

### `permissions.global`

Automatically runs on all admin routes. Checks per-resource permissions and shows `<PermissionDeniedPage>` if the user lacks the required permission for the current route's resource.

---

## Custom Page Access

Each custom page can define its own access check independent of the global one:

```ts
customPages: [
  {
    name: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: 'i-heroicons-chart-bar',
    canAccess: (user) => user?.permissions?.includes('view:reports'),
  },
]
```
