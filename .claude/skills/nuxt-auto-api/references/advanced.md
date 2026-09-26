# Advanced: Aggregations, Permissions, Multi-Tenancy, Custom Endpoints

## `useAutoApiAggregate<T>` — SQL Aggregations

```ts
const { data, isLoading } = useAutoApiAggregate<AggregateResponse>(
  'orders',
  aggregateOptions,    // MaybeRef<AggregateOptions>
  queryOptions?
)
```

### `AggregateOptions`

```ts
interface AggregateOptions {
  aggregate: string | string[]       // 'count', 'count(field)', 'sum(field)', 'avg(field)', 'min(field)', 'max(field)'
  groupBy?: string | string[]
  having?: Record<string, any>       // on aggregate ALIASES: { count: { $gt: 5 } }
  filter?: Record<string, any>       // WHERE before aggregation (readable columns only)
}
```

Aliases: `count`, `count_<field>`, `<fn>_<field>` (e.g. `sum_amount`). Response: `{ data: Array<{ group?: {…}, …aliases }>, meta: { total } }`.

### Examples

```ts
useAutoApiAggregate('posts', { aggregate: 'count' })
// → { data: [{ count: 142 }] }

useAutoApiAggregate('orders', { aggregate: 'sum(amount)', groupBy: 'status' })
// → { data: [{ group: { status: 'paid' }, sum_amount: 48200 }, { group: { status: 'pending' }, sum_amount: 3100 }] }

useAutoApiAggregate('orders', {
  aggregate: ['count', 'sum(amount)', 'avg(amount)'],
  groupBy: ['month', 'region'],
  having: { count: { $gt: 5 } },
  filter: { status: 'completed' },
})
```

Rules: gated by `permissions.aggregate` (falls back to `read`); rows are scoped like the list (tenant, `listFilter`,
soft delete); unknown/hidden fields and malformed expressions are a 400.

Cache key: `['autoapi', resourceName, 'aggregate', aggregateOptions]`

---

## `usePermissions` — Per-resource permissions

```ts
const {
  permissions,     // Ref<PermissionCheckResult | undefined>
  canCreate, canRead, canUpdate, canDelete,   // Ref<boolean>
  isLoading,
  error,
} = usePermissions('posts', { individual?: boolean })
```

By default uses `GET /api/permissions` (all resources, cached as `['permissions', 'all']`). `individual: true` uses `GET /api/posts/permissions`.

```ts
interface PermissionCheckResult {
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
  canRestore?: boolean
  canPurge?: boolean
  canViewDeleted?: boolean
  fields?: { [field: string]: { canRead: boolean, canWrite: boolean } }
}
```

These are for UI (hide buttons); the server still decides every request.

## `useAllPermissions`

```ts
const { data } = useAllPermissions()
// data.value = { user, permissions: { posts: { canCreate, … }, comments: { … } } }
```

---

## Multi-Tenancy

```ts
// nuxt.config.ts
autoApi: {
  multiTenancy: {
    enabled: true,
    tenantIdField: 'organizationId',   // column on scoped tables (default)
    userTenantField: 'organizationId', // property of ctx.user holding the active tenant (default: tenantIdField)
    scopedResources: '*',              // or ['posts', 'tasks']
    excludedResources: ['plans'],      // global tables that happen to have the column
  },
}
```

The tenant is resolved **on the server only**, first match wins:

1. `ctx.tenant` set by a context extender (`addContextExtender` from `@websideproject/nuxt-auto-api/plugins`)
2. `event.context.tenantId` set by your server middleware
3. `ctx.user[userTenantField]` — the better-auth plugin maps `session.activeOrganizationId` there

No header or query parameter is ever read. `getTenantId`, `allowCrossTenantAccess` and `requireTenant` were removed and fail the build.

When scoped:
- every route (list, get, update, delete, restore, bulk, aggregate, `?include=`, both M2M sides) filters to the tenant; other tenants' rows are **404**
- create stamps the tenant column; the column is stripped from every body (can't move rows)
- **fails closed**: no tenant → 403 (401 anonymous) "An active tenant is required"

Cross-tenant staff:

```ts
addContextExtender((ctx) => {
  if (ctx.user?.roles?.includes('superadmin'))
    ctx.tenant = { id: ctx.user.organizationId ?? '', field: 'organizationId', canAccessAllTenants: true }
})
```

---

## Custom Endpoints

`createEndpoint()` (auto-imported; also `@websideproject/nuxt-auto-api/utils`):

```ts
// server/api/posts/export.get.ts
import { z } from 'zod'
import { posts } from '~~/server/database/schema'

export default createEndpoint({
  resource: 'posts',
  operation: 'list',       // gate = the resource's `read` permission (undeclared → denied)
  query: z.object({ format: z.enum(['csv', 'json']).default('json') }),
  handler: async (ctx) => {
    // The gate does NOT scope rows — apply the same row rules as the list:
    const rows = await ctx.db.select().from(posts).where(rowScope(ctx, 'posts', posts))
    return ctx.queryParams.format === 'csv' ? toCsv(rows) : rows
  },
})
```

- Resource-bound: auth + plugin middleware + the resource's permission for `operation` + validation, then your handler.
- `endpointName`: `authorization.custom[name].permissions` decides the ops it declares; undeclared ops fall back to the resource gate.
- Standalone (no `resource`) and `getAutoApiContext(event)`: caller resolved, **nothing authorized** — gate it yourself.
- Handlers return the payload; `responseFormat: 'auto'` (default) wraps it in `{ data }`. Never hand-wrap.

### Row access helpers

| Helper | Use |
|---|---|
| `findAuthorizedRow(ctx, resource, id, { softDeleted? })` | One row; invisible → 404, objectLevel fails → 403 |
| `findAuthorizedRows(ctx, resource, ids)` | Visible subset of ids |
| `rowScope(ctx, resource, table, { softDeleted? })` | SQL condition (tenant + listFilter + soft delete) |
| `passesObjectLevel(ctx, resource, row)` | Run objectLevel |
| `assertResourcePermission(resource, op, ctx, { recordId? })` | 401/403 for any registered resource |
| `protectedFieldsFor(ctx, resource, table, 'create'\|'update')` + `stripProtectedFields` | Drop server-owned columns from input |
| `tenantWriteField(ctx, resource, table)` | Tenant column to stamp on writes |
| `insertReturning` / `updateReturning` | Rows back on every dialect (MySQL has no RETURNING) |

### Object-level auth before the handler

```ts
export default createEndpoint({
  resource: 'webhooks',
  operation: 'get',
  endpointName: 'secret',
  authorize: async (ctx) => {
    const hook = await findAuthorizedRow(ctx, 'webhooks', ctx.params.id)  // 404/403 thrown for you
    ctx.requestMeta ??= {}
    ctx.requestMeta.webhook = hook   // stash for the handler
    return hook.userId === ctx.user?.id
  },
  handler: async ctx => ({ secret: ctx.requestMeta!.webhook.secretHint }),
})
```

### `EndpointOptions`

```ts
interface EndpointOptions<TBody, TQuery, TResponse> {
  resource?: string
  operation?: HandlerContext['operation']
  endpointName?: string
  body?: ZodSchema
  query?: ZodSchema
  skipAuthorization?: boolean   // the resource gate only — you still scope rows
  skipValidation?: boolean
  authorize?: (ctx, event) => boolean | Promise<boolean>
  handler: (ctx, event) => Promise<TResponse> | TResponse
  transform?: (data, ctx) => any
  responseFormat?: 'auto' | 'raw'
}
```
