# @websideproject/nuxt-auto-api

[![npm version](https://img.shields.io/npm/v/@websideproject/nuxt-auto-api?color=black)](https://npmjs.com/package/@websideproject/nuxt-auto-api)
[![npm downloads](https://img.shields.io/npm/dm/@websideproject/nuxt-auto-api?color=black)](https://npm.chart.dev/@websideproject/nuxt-auto-api)
[![license](https://img.shields.io/github/license/websideproject/nuxt-auto?color=black)](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE)

Schema-driven REST APIs for Nuxt. Register a Drizzle table, declare who may do what, and get list / get /
create / update / delete, bulk, aggregations, many-to-many and permission endpoints — plus TanStack Query
composables for the client.

- **Secure by default** — every operation is denied until you declare who may perform it
- **Row visibility everywhere** — tenant scoping, `listFilter`, soft delete and `objectLevel` apply to every
  route: list, get, update, delete, restore, bulk, aggregate, M2M and `?include=`
- **Server-owned columns** — tenant, soft-delete and audit columns (and the primary key on update, or on create when the database generates it) can never be written by a request body
- **Filtering, sorting, keyset pagination, nested includes, aggregations** — restricted to columns the caller may read
- **Soft delete, cascade and restore**, field-level permissions, lifecycle hooks, a plugin system
- **SQLite, D1, Turso, Postgres, MySQL, PlanetScale**
- **Nuxt 4** (and Nuxt 5 nightly)

## Install

```bash
npx nuxt module add @websideproject/nuxt-auto-api
```

## Quick start

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@websideproject/nuxt-auto-api', './modules/blog'],
})
```

```ts
// server/plugins/database.ts — hand auto-api your Drizzle instance and name the engine
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { initializeDatabase } from '@websideproject/nuxt-auto-api/database'
import * as schema from '../../modules/blog/schema'

export default defineNitroPlugin(() => {
  initializeDatabase(drizzle(new Database('sqlite.db'), { schema }), 'better-sqlite3') // or 'postgres', 'mysql', 'd1', 'turso', 'planetscale'
})
```

```ts
// modules/blog/index.ts — register resources from a module
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

export default defineNuxtModule({
  setup(_, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    nuxt.hook('autoApi:registerSchema', (registry) => {
      registry.register('posts', {
        schema: createModuleImport(resolve('./schema'), 'posts'),
        authorization: createModuleImport(resolve('./auth'), 'postsAuth'),
      })
    })
  },
})
```

```ts
// modules/blog/auth.ts
import { eq, or } from 'drizzle-orm'
import type { ResourceAuthConfig } from '@websideproject/nuxt-auto-api'

export const postsAuth: ResourceAuthConfig = {
  permissions: {
    read: true, // anyone
    create: ctx => !!ctx.user, // signed-in users
    update: ctx => !!ctx.user,
    delete: 'posts:delete', // callers holding this permission
  },
  // Which rows a caller may see — applied to EVERY route, not only lists.
  listFilter: (posts, ctx) => ctx.user ? or(eq(posts.published, true), eq(posts.authorId, ctx.user.id)) : eq(posts.published, true),
  // Per-row check: anyone may read a visible post; only its author may change or delete it.
  objectLevel: (post, ctx) => ctx.operation === 'list' || ctx.operation === 'get' || post.authorId === ctx.user?.id,
}
```

That's `GET/POST /api/posts`, `GET/PATCH/DELETE /api/posts/:id`, `/api/posts/bulk`, `/api/posts/aggregate`,
`/api/posts/:id/relations/:relation`, `/api/posts/permissions` and `/api/permissions`.

```vue
<script setup lang="ts">
const { data } = useAutoApiList('posts', { sort: '-createdAt', include: 'author[id,name]', limit: 20 })
const { mutate: createPost } = useAutoApiCreate('posts')
</script>
```

## Security model

| | |
|---|---|
| Undeclared operation | **Denied** (401 anonymous / 403 signed in). `true` = public, `false` = nobody — not even `*` |
| `*` permission | Super-admin: passes everything except an explicit `false` |
| Row visibility | Tenant + `listFilter` + soft delete on every route; `objectLevel` per row |
| Request bodies | Tenant, soft-delete and audit columns are dropped (the primary key on update too, and on create when the database generates it); field-level `write` rules refuse with 403 |
| Queries | `filter` / `sort` / `groupBy` / aggregates / include filters may only name readable columns — unknown fields and operators are 400s |
| `?include=` | Needs `read` on the related resource and applies its row visibility and field rules |
| Tenancy | Resolved on the server only (`event.context.tenantId`, `ctx.user.organizationId`, or an extender); fails closed |

## Documentation

- [Getting started](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/1.getting-started.md)
- [Authentication & authorization](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/6.authentication-authorization.md) · [Permissions cookbook](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/18.permissions-cookbook.md) · [better-auth](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/7.better-auth.md)
- [Multi-tenancy](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/16.multi-tenancy.md) · [Soft deletes](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/5.soft-deletes.md) · [Validation](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/2.validation.md)
- [Pagination](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/4.pagination.md) · [Nested relationships](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/8.nested-relationships.md) · [Bulk operations](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/9.bulk-operations.md) · [Aggregations](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/10.aggregations.md) · [M2M](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/12.m2m-relationships.md)
- [Frontend composables](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/32.frontend-composables.md) · [Custom endpoints](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/15.custom-endpoints.md) · [Lifecycle hooks](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/11.lifecycle-hooks.md)
- [Plugin system](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/13.plugin-system.md) · [Plugin catalog](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/22.plugin-catalog.md) · [Rate limiting](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/20.rate-limiting.md)
- [Database adapters](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/14.database-adapters.md) · [Cloudflare D1](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/30.cloudflare-d1.md) · [Testing](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/33.testing.md)
- [Configuration](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/23.configuration.md) · [Upgrading](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/2.auto-api/40.upgrading.md)

An admin panel for these resources: [@websideproject/nuxt-auto-admin](https://npmjs.com/package/@websideproject/nuxt-auto-admin).

## Links

- [GitHub](https://github.com/websideproject/nuxt-auto)
- [Issues](https://github.com/websideproject/nuxt-auto/issues) · [Discussions](https://github.com/websideproject/nuxt-auto/discussions)
- [Releases](https://github.com/websideproject/nuxt-auto/releases)

## License

[MIT](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE)
