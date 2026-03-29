# Advanced: Aggregations, Permissions, Multi-Tenancy

## `useAutoApiAggregate<T>` — SQL Aggregations

```ts
const { data, isLoading } = useAutoApiAggregate<AggregateResult>(
  'orders',
  aggregateOptions,    // MaybeRef<AggregateOptions>
  queryOptions?
)
```

### `AggregateOptions`

```ts
interface AggregateOptions {
  aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max' | string[]
  field?: string                    // field to aggregate (required for sum/avg/min/max)
  groupBy?: string | string[]       // group by field(s)
  having?: Record<string, any>      // filter on aggregated values
  filter?: Record<string, any>      // WHERE filter before aggregation
}
```

### Examples

```ts
// Count all posts
useAutoApiAggregate('posts', { aggregate: 'count' })
// → { _count: 142 }

// Sum revenue by status
useAutoApiAggregate('orders', {
  aggregate: 'sum',
  field: 'amount',
  groupBy: 'status',
})
// → [{ status: 'paid', _sum: 48200 }, { status: 'pending', _sum: 3100 }]

// Average order value, only completed orders
useAutoApiAggregate('orders', {
  aggregate: 'avg',
  field: 'amount',
  filter: { status: 'completed' },
})

// Multiple aggregations
useAutoApiAggregate('orders', {
  aggregate: ['count', 'sum', 'avg'],
  field: 'amount',
  groupBy: ['month', 'region'],
  having: { _count: { gt: 5 } },  // only groups with more than 5 orders
})
```

### Cache key

```ts
['autoapi', resourceName, 'aggregate', aggregateOptions]
```

---

## `usePermissions` — Per-resource permissions

```ts
const {
  permissions,     // Ref<PermissionCheckResult | undefined>
  canCreate,       // Ref<boolean>
  canRead,         // Ref<boolean>
  canUpdate,       // Ref<boolean>
  canDelete,       // Ref<boolean>
  isLoading,
  error,
} = usePermissions(
  'posts',          // MaybeRef<string>
  options?: {
    individual?: boolean  // default: false — use global /api/permissions endpoint
  }
)
```

By default uses `GET /api/permissions` (fetches all resources at once, cached as `['permissions', 'all']`). Set `individual: true` to use `GET /api/posts/permissions`.

### `PermissionCheckResult`

```ts
interface PermissionCheckResult {
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
  fields?: {
    [fieldName: string]: {
      canRead: boolean
      canWrite: boolean
    }
  }
}
```

---

## `useAllPermissions` — All resource permissions

Fetches all resource permissions in one request. More efficient than calling `usePermissions` per resource.

```ts
const { data, isLoading } = useAllPermissions(options?)

// data.value = {
//   user: { id: 1, ... },
//   permissions: {
//     posts:    { canCreate: true, canRead: true, canUpdate: true, canDelete: false },
//     comments: { canCreate: true, canRead: true, canUpdate: false, canDelete: false },
//   }
// }
```

Cache key: `['permissions', 'all']`

---

## Multi-Tenancy

Configure in `autoApi.multiTenancy`:

```ts
multiTenancy: {
  enabled: true,
  tenantIdField: 'organizationId',     // default: 'organizationId'

  // How to resolve the current tenant from the request
  getTenantId: async (event) => {
    const session = await getAuthSession(event)
    return session?.user?.organizationId ?? null
  },

  // Which resources enforce tenant isolation
  scopedResources: '*',                // all resources
  // scopedResources: ['posts', 'tasks'],
  excludedResources: ['plans', 'features'],

  // Who can bypass tenant scoping
  allowCrossTenantAccess: (user) => user.roles?.includes('superadmin'),

  // Reject requests with no resolvable tenant
  requireTenant: false,
}
```

When tenant isolation is active:
- **List**: WHERE `tenantId = <current>` is automatically appended
- **Get**: Returns 404 if `tenantId` doesn't match
- **Create**: Automatically sets `tenantId` on new records
- **Update/Delete**: Only affects records belonging to the current tenant

---

## Custom Endpoints

Use `createEndpoint()` (from `@websideproject/nuxt-auto-api/utils`) to build custom server routes with shared auth/validation:

```ts
// server/api/posts/export.get.ts
import { createEndpoint } from '@websideproject/nuxt-auto-api/utils'
import { z } from 'zod'

export default createEndpoint({
  resource: 'posts',
  operation: 'list',       // re-uses list authorization
  query: z.object({ format: z.enum(['csv', 'json']).default('json') }),
  skipAuthorization: false,
  handler: async (ctx, event) => {
    const posts = await ctx.db.query.posts.findMany({ ... })
    if (ctx.validated.query.format === 'csv') {
      return toCsv(posts)
    }
    return { data: posts }
  },
  responseFormat: 'raw',   // bypass the { data: } wrapper
})
```

### `EndpointOptions`

```ts
interface EndpointOptions<TBody, TQuery, TResponse> {
  resource?: string
  operation?: HandlerContext['operation']
  body?: ZodSchema              // Zod schema for request body validation
  query?: ZodSchema             // Zod schema for query string validation
  skipAuthorization?: boolean
  skipValidation?: boolean
  handler: (ctx: EndpointContext<TBody, TQuery>, event: H3Event) => Promise<TResponse>|TResponse
  transform?: (data: TResponse, ctx: EndpointContext) => any
  responseFormat?: 'auto' | 'raw'  // 'auto' = wrap in { data: ... }, 'raw' = pass-through
}
```

`EndpointContext` extends `HandlerContext` with `validated.body` and `validated.query` typed by the Zod schemas.
