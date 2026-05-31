# Authorization

Authorization is configured per-resource via the `authorization` field in `registry.register()` (the build-time path) or via `autoApi.authorization` in `nuxt.config.ts` (the override path).

> **⚠️ Functions vs strings — this distinction is load-bearing.**
> `autoApi.authorization` in `nuxt.config.ts` is assigned into **`runtimeConfig`** by the module, which Nuxt serializes — so **only `string` / `string[]` permission rules survive there**. `PermissionFunction`s, `listFilter`, and `objectLevel` are **silently dropped** from the config-object form and kept from the resource's build-time default.
>
> **Functions are only honored when declared at build time:** in a module's `auth.ts` passed to `registry.register({ authorization })`, or in an app-level build-time authorization file (string-path form of the option, where supported). The config-object form is for **string/array overrides only**.
>
> All the function-based examples below (`(ctx) => …`, `objectLevel`, `listFilter`) therefore belong in a **build-time `auth.ts`** (see "Authorization from Module Registration"), **not** in a `nuxt.config.ts` `authorization: { … }` object.

---

## `ResourceAuthConfig`

```ts
interface ResourceAuthConfig {
  // Operation-level guards
  permissions?: {
    read?:   PermissionRule    // GET list + get
    create?: PermissionRule    // POST
    update?: PermissionRule    // PATCH
    delete?: PermissionRule    // DELETE
    m2m?: M2MPermissionConfig
  }

  // Post-fetch item filter (applied per item after list query)
  objectLevel?: (object: any, ctx: HandlerContext) => boolean | Promise<boolean>

  // SQL WHERE clause filter (applied before query — more efficient than objectLevel)
  listFilter?: (table: any, ctx: HandlerContext) => SQL | undefined

  // Field-level guards
  fields?: {
    [fieldName: string]: {
      read?:  PermissionRule
      write?: PermissionRule
    }
  }
}

type PermissionRule =
  | string                   // single role/permission string
  | string[]                 // any of these roles/permissions
  | ((ctx: HandlerContext) => boolean | Promise<boolean>)
```

---

## `HandlerContext`

Available in all authorization functions, hooks, and plugin middleware.

```ts
interface HandlerContext {
  db: any                         // Drizzle database instance
  schema: any                     // Drizzle schema (table exports)
  fullSchema?: any                // Full schema including relations
  user: AuthUser | null           // Current authenticated user (null if unauthenticated)
  permissions: string[]           // User's global permission strings (from session.user.permissions)
  params: Record<string, string>  // Route params (e.g. { id: '123' })
  query: Record<string, any>      // Query string params
  validated: { body?: any; query?: any }  // Zod-validated request data
  event: H3Event                  // Raw H3/Nitro event
  resource: string                // Resource name (e.g. 'posts')
  operation: 'list' | 'get' | 'create' | 'update' | 'delete' | 'bulk' | 'aggregate' | 'm2m'
  tenant?: { id: string|number; field: string; canAccessAllTenants: boolean }
  additionalFilters?: SQL[]       // Push extra SQL conditions here (in hooks/plugins)
  requestMeta?: {
    ip?: string; country?: string; userAgent?: string
    // Extended by context extender plugins — see requestMeta Extensions below
    [key: string]: any
  }
}

interface AuthUser {
  id: string | number
  email?: string
  roles?: string[]               // global user roles
  permissions?: string[]         // global user permissions
  organizationId?: string | null // active org ID (set by auth plugin from session)
  [key: string]: any
}
```

---

## `requestMeta` Extensions

Context extender plugins populate `requestMeta` with domain-specific data once per request, making it available to all permission functions without extra DB calls per resource.

### Billing context (`requestMeta.billing`)

Set by `@websideproject/module-auto-billing`'s `billing-context` plugin. Reflects the **active org's subscription** when `user.organizationId` is set, otherwise the user's personal subscription.

```ts
// In resource auth.ts — no imports needed
const billing = (ctx: any) => ctx.requestMeta?.billing as {
  status: string
  planId: string | null
  isActive: boolean
  isTrialing: boolean
  isPastDue: boolean
  features: string[]
  trialEndsAt: Date | null
} | undefined

// Gate on active/trialing subscription
create: (ctx) => billing(ctx)?.isActive || billing(ctx)?.isTrialing

// Gate on a specific feature flag from the plan config
create: (ctx) => billing(ctx)?.features.includes('api_access') ?? false
```

### Org member role (`requestMeta.orgRole`)

Set by the auth context-extender plugin (in `server/autoapi-plugins.ts`). Resolved from the **`orgMemberRoles` map** on the session user — a `{ [orgId]: role }` JSON object cached in the session cookie — indexed by the session's `activeOrganizationId`. **Zero DB queries per request** (it's read from the cookie cache, not `auth_members`). Is `null` when no active org is set in the session.

```ts
// Equivalent of what the plugin does:
//   const map = JSON.parse(session.user.orgMemberRoles ?? '{}')   // all orgs → role
//   ctx.requestMeta.orgRole = map[session.activeOrganizationId] ?? null   // active org only

const orgRole = (ctx: any) => ctx.requestMeta?.orgRole as
  'owner' | 'admin' | 'member' | null

// Only org owners and admins can create when inside an org context
create: (ctx) => {
  if (!ctx.user) return false
  const role = orgRole(ctx)
  if (role !== null) return role === 'owner' || role === 'admin'
  return true  // no active org — fall through to personal auth
}
```

> `requestMeta.orgRole` is the role for the **active** org only. To gate an action on a *different* org than the active one (e.g. an explicit `?orgId=`), re-resolve from the full map: `JSON.parse(ctx.user.orgMemberRoles)[targetOrgId]` — don't assume "admin anywhere" means "admin here." The role string may be comma-separated for multi-role members (`"admin,member"`).

### Combining billing + org role

```ts
// Pro plan AND org admin required
create: (ctx) => {
  const b = billing(ctx)
  const role = orgRole(ctx)
  return (b?.isActive || b?.isTrialing) && (role === 'owner' || role === 'admin')
}
```

### Plugin execution order

The standard plugin chain in `server/autoapi-plugins.ts`:

```
auth plugin          →  sets ctx.user + ctx.user.organizationId
org-role plugin      →  queries auth_members → sets ctx.requestMeta.orgRole
billing-context      →  queries billing_subscriptions → sets ctx.requestMeta.billing
resource permission  →  receives fully enriched ctx
```

All three run once per request before any permission function is called.

---

## Examples

> The `authorization: { posts: { … } }` shape below is shown for brevity. **String/array** rules work in either the build-time `auth.ts` or the `nuxt.config.ts` override. **Function** rules (`(ctx) => …`), `objectLevel`, and `listFilter` only work in a build-time `auth.ts` (see "Authorization from Module Registration") — never in the `nuxt.config.ts` config object.

### Role-based (string match) — works in config override OR build-time

```ts
authorization: {
  posts: {
    permissions: {
      read: 'user',                          // any user with role 'user'
      create: ['editor', 'admin'],           // editor or admin
      update: ['editor', 'admin'],
      delete: 'admin',                       // only admin
    },
  },
}
```

### Function-based (custom logic) — **build-time `auth.ts` only**

```ts
// auth.ts → registry.register({ authorization }). NOT valid in nuxt.config (serialized away).
export const postsAuth: ResourceAuthConfig = {
  permissions: {
    read: (ctx) => ctx.user !== null,
    create: (ctx) => ctx.user?.roles?.includes('editor'),
    update: async (ctx) => {
      const user = await getUserWithPlan(ctx.db, ctx.user!.id)
      return user.plan === 'pro'
    },
  },
}
```

### Object-level authorization (post-fetch)

Applied per item after the list query. Use `listFilter` for performance with large datasets.

```ts
authorization: {
  documents: {
    objectLevel: (doc, ctx) => {
      return doc.ownerId === ctx.user?.id || doc.visibility === 'public'
    },
  },
}
```

### SQL-level filter (`listFilter`) — preferred

Appended to the WHERE clause — more efficient than objectLevel.

```ts
import { eq, or } from 'drizzle-orm'

authorization: {
  documents: {
    listFilter: (table, ctx) => {
      if (!ctx.user) return eq(table.visibility, 'public')
      return or(
        eq(table.ownerId, ctx.user.id),
        eq(table.visibility, 'public')
      )
    },
  },
}
```

### Field-level authorization

```ts
authorization: {
  users: {
    fields: {
      email: {
        read: (ctx) => ctx.user?.id === ctx.params.id || ctx.user?.roles?.includes('admin'),
        write: (ctx) => ctx.user?.id === ctx.params.id,
      },
      // Field hidden from non-subscribers — billing-context plugin must be active
      authorEmail: {
        read: (ctx) => billing(ctx)?.isActive || ctx.user?.roles?.includes('admin'),
        write: () => true,
      },
    },
  },
}
```

---

## Custom Endpoint Permissions

Named custom endpoints (created with `createEndpoint({ endpointName: '...' })`) can have their own permission gates declared in `ResourceAuthConfig.custom`. The app can override these from `nuxt.config.ts` using string/array values.

```ts
// auth.ts — module defaults (functions allowed here)
export const postsAuth: ResourceAuthConfig = {
  permissions: { ... },

  custom: {
    export: { permissions: { read: (ctx) => !!ctx.user } },
    publish: { permissions: { update: (ctx) => ctx.user?.roles?.includes('editor') } },
    archive: { permissions: { delete: 'admin' } },
  },
}
```

```ts
// nuxt.config.ts — app override (strings/arrays only, no functions)
autoApi: {
  authorization: {
    posts: {
      custom: {
        export: { permissions: { read: 'admin' } },   // tighten to admin-only
      },
    },
  },
}
```

Permission key is inferred from `operation` (`'get'`/`'list'` → `'read'`, others pass through). The collection-level `permissions.read/create/update/delete` check always runs first; `custom[name]` is an additional gate.

---

## M2M Permission Config

```ts
permissions: {
  m2m?: {
    read?: PermissionRule
    sync?: PermissionRule    // POST /:id/relations/:rel
    add?: PermissionRule     // POST /:id/relations/:rel/add
    remove?: PermissionRule  // DELETE /:id/relations/:rel/remove
  }
}
```

---

## Authorization from Module Registration

```ts
registry.register('posts', {
  schema: createModuleImport(resolver.resolve('./schema'), 'posts'),
  authorization: createModuleImport(resolver.resolve('./auth'), 'postsAuth'),
})

// auth.ts
export const postsAuth: ResourceAuthConfig = {
  permissions: {
    read: (ctx) => !!ctx.user,
    create: ['editor', 'admin'],
    update: (ctx) => ctx.user?.roles?.includes('admin'),
    delete: 'admin',
  },
  listFilter: (table, ctx) =>
    ctx.user ? undefined : eq(table.status, 'published'),
}
```

This is the **build-time** path — functions, `listFilter`, `objectLevel`, and `fields` all work here, because `auth.ts` is imported at build time (via `createModuleImport`), not serialized into `runtimeConfig`.

---

## Overriding a module's authorization from the app

A module ships its default `ResourceAuthConfig` via `registry.register()` (above). An app can change it, with an important limitation:

| You want to override with… | How | Works? |
|---|---|---|
| A **string / string[]** permission (per operation, or `custom.<name>`) | `autoApi.authorization.<resource>` in `nuxt.config.ts` — shallow-merged over the module default per operation | ✅ |
| A **function** (`PermissionFunction`), `listFilter`, or `objectLevel` | the config object form **cannot** carry these (serialized into `runtimeConfig`) | ❌ |

```ts
// nuxt.config.ts — STRING/ARRAY overrides only; merged over the module's auth.ts default
autoApi: {
  authorization: {
    posts: {
      permissions: { create: 'admin' },                          // tighten create to admin
      custom: { export: { permissions: { read: 'admin' } } },    // tighten a custom endpoint
    },
  },
}
```

To override a module gate with a **function** today, either (a) have the module read its requirement from its own module options so you tune it via the module's configKey, or (b) re-register the resource with your own build-time `auth.ts`. (A build-time app-level override file — a string-path form of `authorization`, resolved like `autoApi.plugins` — would close this gap; not currently available.)

---

## Live Permission Checking (Client)

```ts
// Check permissions for a single resource (hits /api/{resource}/permissions)
const { canCreate, canRead, canUpdate, canDelete, refetch } =
  usePermissions('posts', { individual: true })

// Check all resources at once (hits /api/permissions)
const { data } = useAllPermissions()
const canCreatePost = data.value?.permissions?.posts?.canCreate
```

`usePermissions` re-runs the full server-side permission chain on demand — useful for showing live permission state after switching active org or billing plan.
