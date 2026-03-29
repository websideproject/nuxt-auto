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
  permissions: string[]           // User's permission strings
  params: Record<string, string>  // Route params (e.g. { id: '123' })
  query: Record<string, any>      // Query string params
  validated: { body?: any; query?: any }  // Zod-validated request data
  event: H3Event                  // Raw H3/Nitro event
  resource: string                // Resource name (e.g. 'posts')
  operation: 'list' | 'get' | 'create' | 'update' | 'delete' | 'bulk' | 'aggregate' | 'm2m'
  tenant?: { id: string|number; field: string; canAccessAllTenants: boolean }
  requestMeta?: {
    ip?: string; country?: string; userAgent?: string; [key: string]: any
  }
  additionalFilters?: SQL[]       // Push extra SQL conditions here (in hooks/plugins)
}

interface AuthUser {
  id: string | number
  email?: string
  roles?: string[]
  permissions?: string[]
  [key: string]: any
}
```

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
      read: (ctx) => ctx.user !== null,      // must be authenticated
      create: (ctx) => ctx.user?.roles?.includes('editor'),
      update: async (ctx) => {
        // Check subscription tier from DB
        const user = await getUserWithPlan(ctx.db, ctx.user!.id)
        return user.plan === 'pro'
      },
    },
  },
}
```

### Object-level authorization (post-fetch)

Applied per item after the list query runs. Use `listFilter` for performance when possible.

```ts
authorization: {
  documents: {
    objectLevel: (doc, ctx) => {
      // Only own documents or public ones
      return doc.ownerId === ctx.user?.id || doc.visibility === 'public'
    },
  },
}
```

### SQL-level filter (`listFilter`) — preferred

Appended to the WHERE clause — more efficient than objectLevel for large datasets.

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
      salary: {
        read: 'hr',    // only hr role
        write: 'hr',
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

Per-resource auth can be defined alongside the schema in `registry.register()`:

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
