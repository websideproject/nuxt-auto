# Authorization

Authorization is configured per-resource via `autoApi.authorization` in `nuxt.config.ts` or via the `authorization` field in `registry.register()`.

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

Set by the `org-role` context extender plugin (in `server/autoapi-plugins.ts`). Queries `auth_members` for the user's role in their active org. Is `null` when no active org is set in the session.

```ts
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

### Role-based (string match)

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

### Function-based (custom logic)

```ts
authorization: {
  posts: {
    permissions: {
      read: (ctx) => ctx.user !== null,
      create: (ctx) => ctx.user?.roles?.includes('editor'),
      update: async (ctx) => {
        const user = await getUserWithPlan(ctx.db, ctx.user!.id)
        return user.plan === 'pro'
      },
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
