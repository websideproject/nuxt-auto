---
name: nuxt-auto-api
description: Use when working with nuxt-auto-api (@websideproject/nuxt-auto-api) - schema-driven REST API generation from Drizzle ORM schemas with authorization, hooks, bulk ops, M2M, aggregation, and a plugin system.
license: MIT
---

# nuxt-auto-api

Auto-generates type-safe REST APIs from Drizzle ORM table schemas for Nuxt 4. Register a Drizzle table and instantly get CRUD endpoints, filtering, sorting, pagination, relations, permissions, soft-delete, bulk ops, aggregation, and M2M — with lifecycle hooks and a plugin system.

## When to Use

- Registering Drizzle tables as auto-generated API resources
- Using `useAutoApiList`, `useAutoApiGet`, `useAutoApiCreate`, `useAutoApiUpdate`, `useAutoApiDelete`
- Configuring authorization (`permissions`, `objectLevel`, `listFilter`)
- Writing lifecycle hooks (`beforeCreate`, `afterCreate`, etc.)
- Bulk operations (`useAutoApiBulkCreate/Update/Delete`)
- Aggregations (`useAutoApiAggregate`)
- M2M relationships (`useM2MRelation`, `useM2MSync`, `useM2MAdd`, `useM2MRemove`)
- Checking permissions (`usePermissions`, `useAllPermissions`)
- Building plugins with `defineAutoApiPlugin`

## Quick Start

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@websideproject/nuxt-auto-api'],
  autoApi: {
    prefix: '/api',
  },
})

// modules/blog/index.ts — resources are registered at BUILD time from a Nuxt module
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

export default defineNuxtModule({
  setup(_, nuxt) {
    const r = createResolver(import.meta.url)
    nuxt.hook('autoApi:registerSchema', (registry) => {
      registry.register('posts', {
        schema: createModuleImport(r.resolve('./schema'), 'posts'),
        authorization: createModuleImport(r.resolve('./auth'), 'postsAuth'), // REQUIRED — see below
      })
    })
  },
})

// modules/blog/auth.ts
export const postsAuth: ResourceAuthConfig = {
  permissions: { read: true, create: ctx => !!ctx.user, update: 'posts:write', delete: 'admin' },
}
```

**Deny by default:** an undeclared operation is refused (401 anon / 403 signed in); a resource with no
`authorization` refuses everything. `'*'` in `ctx.permissions` passes all. Rows the caller can't see (tenant,
`listFilter`, soft delete, `objectLevel`) are 404 on every route. Unknown/hidden fields in filter/sort/fields are 400.

```vue
<!-- pages/posts.vue -->
<script setup>
const { data, isLoading } = useAutoApiList('posts', {
  filter: { status: 'published' },
  sort: '-createdAt',
  limit: 20,
  include: ['author'],
})
const create = useAutoApiCreate('posts')
</script>
```

## Auto-Generated Endpoints

For each resource `{name}`:
```
GET    /api/{name}              List (filter, sort, paginate, include relations)
GET    /api/{name}/:id          Get by ID
POST   /api/{name}              Create
PATCH  /api/{name}/:id          Update
DELETE /api/{name}/:id          Delete (soft-delete if deletedAt column exists; ?force=true purges — needs `purge` perm)
POST   /api/{name}/:id/restore  Restore soft-deleted (restores its cascade batch too)
GET    /api/{name}/permissions  Per-resource permissions
POST   /api/{name}/bulk         Bulk create
PATCH  /api/{name}/bulk         Bulk update
DELETE /api/{name}/bulk         Bulk delete
GET    /api/{name}/aggregate    Aggregate (count/sum/avg/min/max + groupBy)
GET    /api/{name}/:id/relations/:rel       List M2M
POST   /api/{name}/:id/relations/:rel       Sync M2M
POST   /api/{name}/:id/relations/:rel/add   Add M2M
DELETE /api/{name}/:id/relations/:rel/remove Remove M2M
POST   /api/{name}/:id/relations/batch      Sync several relations
GET    /api/permissions         All resource permissions
```

## Available Guidance

| File | Topics |
|------|--------|
| **[references/setup.md](references/setup.md)** | Module options, database adapters, resource registration, built-in plugins list |
| **[references/composables-query.md](references/composables-query.md)** | useAutoApiList, useAutoApiGet, useAutoApiInfinite — all query params |
| **[references/composables-mutations.md](references/composables-mutations.md)** | useAutoApiCreate/Update/Delete/Mutation, bulk ops, optimistic updates |
| **[references/authorization.md](references/authorization.md)** | ResourceAuthConfig, permissions, listFilter, objectLevel, fields, **custom endpoint permissions** |
| **[references/hooks-plugins.md](references/hooks-plugins.md)** | ResourceHooks, defineAutoApiPlugin, middleware, context extenders; **hook execution order, frozen-result caveat, requestMeta bridge** |
| **[references/m2m.md](references/m2m.md)** | M2M config, useM2MRelation, useM2MSync, useM2MAdd, useM2MRemove, useM2MBatchSync |
| **[references/advanced.md](references/advanced.md)** | useAutoApiAggregate, usePermissions, multi-tenancy, **createEndpoint with endpointName + authorize** |
| **[references/module-authoring.md](references/module-authoring.md)** | createModuleImport, schema/auth/hooks/validation co-location, **JSON columns (mode:'json')** |
| **[references/schema-presets.md](references/schema-presets.md)** | Cross-engine `id`/`timestamps`/`softDelete`/`tenant`/`audit`/`liveUnique` presets — "import = feature on" |

Whole-batch restore/purge (by `deletionId`) is a server util: `restoreSoftDeletedBatch(ctx, id)` / `purgeSoftDeletedBatch(ctx, id)` — all-or-nothing, permission + visibility checked per row.

## Progressive Loading

- Setting up the module or registering resources? → [references/setup.md](references/setup.md)
- Reading/listing data? → [references/composables-query.md](references/composables-query.md)
- Creating/updating/deleting? → [references/composables-mutations.md](references/composables-mutations.md)
- Controlling who can do what? → [references/authorization.md](references/authorization.md)
- Reacting to CRUD events or writing plugins? → [references/hooks-plugins.md](references/hooks-plugins.md)
- Many-to-many relationships? → [references/m2m.md](references/m2m.md)
- Aggregations, permissions, multi-tenancy? → [references/advanced.md](references/advanced.md)
- Building a Nuxt module that ships resources? → [references/module-authoring.md](references/module-authoring.md)
- Defining cross-cutting table columns (timestamps/softDelete/audit)? → [references/schema-presets.md](references/schema-presets.md)

**DO NOT read all files at once.**

## Related Skills

- **`nuxt-auto-admin`** — admin UI that consumes these API endpoints
- **`nuxt`** — Nuxt 4 server routes and module patterns
- **`nuxthub`** — Cloudflare D1/KV/Blob storage

_Token efficiency: Main skill ~400 tokens. Each reference ~800–1400 tokens._
