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
    database: { client: 'd1' },
  },
})

// server/plugins/register-api.ts — register resources via hook
export default defineNitroPlugin((nitroApp) => {
  // Resources are registered at build time via nuxt hook:
  // nuxt.hook('autoApi:registerSchema', (registry) => { registry.register(...) })
})
```

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
DELETE /api/{name}/:id          Delete (soft-delete if deletedAt column exists)
POST   /api/{name}/:id/restore  Restore soft-deleted
GET    /api/{name}/permissions  Per-resource permissions
POST   /api/{name}/bulk         Bulk create
PATCH  /api/{name}/bulk         Bulk update
DELETE /api/{name}/bulk         Bulk delete
GET    /api/{name}/aggregate    Aggregate (count/sum/avg/min/max + groupBy)
GET    /api/{name}/:id/relations/:rel       List M2M
POST   /api/{name}/:id/relations/:rel       Sync M2M
POST   /api/{name}/:id/relations/:rel/add   Add M2M
DELETE /api/{name}/:id/relations/:rel/remove Remove M2M
GET    /api/permissions         All resource permissions
```

## Available Guidance

| File | Topics |
|------|--------|
| **[references/setup.md](references/setup.md)** | Module options, database adapters, resource registration, built-in plugins list |
| **[references/composables-query.md](references/composables-query.md)** | useAutoApiList, useAutoApiGet, useAutoApiInfinite — all query params |
| **[references/composables-mutations.md](references/composables-mutations.md)** | useAutoApiCreate/Update/Delete/Mutation, bulk ops, optimistic updates |
| **[references/authorization.md](references/authorization.md)** | ResourceAuthConfig, HandlerContext, permissions, listFilter, objectLevel, fields |
| **[references/hooks-plugins.md](references/hooks-plugins.md)** | ResourceHooks (all lifecycle events), defineAutoApiPlugin, middleware, context extenders |
| **[references/m2m.md](references/m2m.md)** | M2M config, useM2MRelation, useM2MSync, useM2MAdd, useM2MRemove, useM2MBatchSync |
| **[references/advanced.md](references/advanced.md)** | useAutoApiAggregate, usePermissions, useAllPermissions, multi-tenancy, custom endpoints |
| **[references/module-authoring.md](references/module-authoring.md)** | Building a Nuxt module that registers resources: hook, createModuleImport, schema/auth/hooks co-location |

## Progressive Loading

- Setting up the module or registering resources? → [references/setup.md](references/setup.md)
- Reading/listing data? → [references/composables-query.md](references/composables-query.md)
- Creating/updating/deleting? → [references/composables-mutations.md](references/composables-mutations.md)
- Controlling who can do what? → [references/authorization.md](references/authorization.md)
- Reacting to CRUD events or writing plugins? → [references/hooks-plugins.md](references/hooks-plugins.md)
- Many-to-many relationships? → [references/m2m.md](references/m2m.md)
- Aggregations, permissions, multi-tenancy? → [references/advanced.md](references/advanced.md)
- Building a Nuxt module that ships resources? → [references/module-authoring.md](references/module-authoring.md)

**DO NOT read all files at once.**

## Related Skills

- **`nuxt-auto-admin`** — admin UI that consumes these API endpoints
- **`nuxt`** — Nuxt 4 server routes and module patterns
- **`nuxthub`** — Cloudflare D1/KV/Blob storage

_Token efficiency: Main skill ~400 tokens. Each reference ~800–1400 tokens._
