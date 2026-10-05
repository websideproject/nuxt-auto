# Custom Actions & Permissions

## Custom Actions

Buttons next to the built-in ones. Handlers are functions, and a function in `nuxt.config` cannot reach the
running app — so actions live in **`app/admin.actions.ts`** (or the file `autoAdmin.actions` points at), never in
`autoAdmin.resources.<name>.actions` (that key fails the build with a pointer to the file). The file is found at
startup: restart dev after creating it.

```ts
// app/admin.actions.ts — defineAdminActions is auto-imported
export default defineAdminActions({
  articles: {
    publish: {
      label: 'Publish',
      icon: 'i-heroicons-rocket-launch',
      type: 'single',
      location: ['row', 'detail'],
      permission: 'update',                       // the API's answer — for a row, that row's
      confirm: article => `Publish "${article.title}"?`,
      handler: async (article, ctx) => {
        await $fetch(ctx.path(article.id), { method: 'PATCH', body: { published: true } })
        await ctx.refresh()
        ctx.toast.success(`"${article.title}" is live`)
      },
    },
  },
})
```

### `CustomAction`

```ts
interface CustomAction {
  label: string
  icon?: string
  type: 'single' | 'bulk' | 'page-level'
  location: 'row' | 'toolbar' | 'detail' | Array<…>  // single: row and/or detail; bulk/page-level: always toolbar
  permission?: 'create' | 'read' | 'update' | 'delete' | ((ctx: { resource: string, item?: any }) => boolean)
  handler: (item: any, ctx: ActionContext) => Promise<void> | void
  confirm?: string | ((item: any) => string)
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'   // Nuxt UI
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}
```

A `permission` function runs while the admin renders (it may call the app's composables) and must be synchronous.
A refused action is disabled or hidden per `permissions.unauthorizedButtons`. It only decides which buttons show —
the API still decides what the handler's requests may do.

### `ActionContext`

```ts
interface ActionContext {
  resource: string
  refresh: () => Promise<void>                 // invalidates ['autoapi', resource]: every list and record
  toast: { success(message), error(message, error?) }
  path: (...segments) => string                // ctx.path(7) → '/api/articles/7' (API prefix honoured)
}
```

There is no `user` in the context — read your auth state in a `permission` function or in the handler file.
A handler that throws gets an error toast with the API's message.

### Types and places

| Type | Receives | Shown in |
|------|----------|----------|
| `single` | the record | `row`: the row menu after View/Edit/Delete · `detail`: detail page + view modal |
| `bulk` | the selected rows of the page | list toolbar while rows are selected (`Label (n)`); rows become selectable even without delete permission |
| `page-level` | `undefined` | next to "Create New" |

`features.bulkActions: false` turns row selection off, custom bulk actions included.

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

Who may open the admin at all is decided by your own named route middleware, run on every admin page:

```ts
autoAdmin: {
  middleware: 'auth', // app/middleware/auth.ts
}
```

`access: (user) => …` is not supported — a function in `nuxt.config` never reaches the app, so it fails the build.
The admin only offers what the API allows the caller; data access is always enforced by nuxt-auto-api.

---

## Middleware

### `permissions.global`

Automatically runs on all admin routes. Checks per-resource permissions and shows `<PermissionDeniedPage>` if the user lacks the required permission for the current route's resource.

---

## Custom Page Access

A custom page is guarded by API permissions (`'<resource>:<action>'`), or by a route middleware on the page itself.
`canAccess: (user) => …` fails the build (a function in nuxt.config never reaches the app):

```ts
customPages: [
  {
    name: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: 'i-heroicons-chart-bar',
    permissions: ['reports:read'],
  },
]
```
