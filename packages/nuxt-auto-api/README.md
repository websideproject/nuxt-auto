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

## In the playground

The repo's playground runs these on a seeded database; the pictures are its CI screenshots.

**Roles, rows and fields.** A regular user's [permissions](https://websideproject.com/docs/nuxt-auto/auto-api/authentication-authorization), from `GET /api/permissions`:

![A permission matrix for a regular user: posts allows create, read, update and delete; articles, users and categories allow read only](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/api-permission-matrix-1440.png)

**[Nested includes](https://websideproject.com/docs/nuxt-auto/auto-api/nested-relationships)** with field selection and a limit:

![The include builder: author fields id and name, limit 2, the query /api/posts?include=author[id,name]&limit=2 and its response](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/api-nested-relations-1440.png)

**[Aggregations](https://websideproject.com/docs/nuxt-auto/auto-api/aggregations)** grouped by a column:

![The aggregation builder: sum of id grouped by published, a bar per group and the JSON response](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/api-aggregations-1440.png)

**[Scoped API tokens](https://websideproject.com/docs/nuxt-auto/auto-api/plugin-catalog)**: an editor token may read articles and nothing it holds no scope for:

![Scope tests with the editor token: GET /api/articles allowed; GET /api/posts, GET /api/users and DELETE /api/articles/1 denied](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/api-token-scopes-1440.png)

## Documentation

Full documentation: [websideproject.com/docs/nuxt-auto](https://websideproject.com/docs/nuxt-auto/getting-started/introduction)

- [Getting started](https://websideproject.com/docs/nuxt-auto/auto-api/getting-started)
- [Authentication & authorization](https://websideproject.com/docs/nuxt-auto/auto-api/authentication-authorization) · [Permissions cookbook](https://websideproject.com/docs/nuxt-auto/auto-api/permissions-cookbook) · [better-auth](https://websideproject.com/docs/nuxt-auto/auto-api/better-auth)
- [Multi-tenancy](https://websideproject.com/docs/nuxt-auto/auto-api/multi-tenancy) · [Soft deletes](https://websideproject.com/docs/nuxt-auto/auto-api/soft-deletes) · [Validation](https://websideproject.com/docs/nuxt-auto/auto-api/validation)
- [Pagination](https://websideproject.com/docs/nuxt-auto/auto-api/pagination) · [Nested relationships](https://websideproject.com/docs/nuxt-auto/auto-api/nested-relationships) · [Bulk operations](https://websideproject.com/docs/nuxt-auto/auto-api/bulk-operations) · [Aggregations](https://websideproject.com/docs/nuxt-auto/auto-api/aggregations) · [M2M](https://websideproject.com/docs/nuxt-auto/auto-api/m2m-relationships)
- [Frontend composables](https://websideproject.com/docs/nuxt-auto/auto-api/frontend-composables) · [Custom endpoints](https://websideproject.com/docs/nuxt-auto/auto-api/custom-endpoints) · [Lifecycle hooks](https://websideproject.com/docs/nuxt-auto/auto-api/lifecycle-hooks)
- [Plugin system](https://websideproject.com/docs/nuxt-auto/auto-api/plugin-system) · [Plugin catalog](https://websideproject.com/docs/nuxt-auto/auto-api/plugin-catalog) · [Rate limiting](https://websideproject.com/docs/nuxt-auto/auto-api/rate-limiting)
- [Database adapters](https://websideproject.com/docs/nuxt-auto/auto-api/database-adapters) · [Cloudflare D1](https://websideproject.com/docs/nuxt-auto/auto-api/cloudflare-d1) · [Testing](https://websideproject.com/docs/nuxt-auto/auto-api/testing)
- [Configuration](https://websideproject.com/docs/nuxt-auto/auto-api/configuration) · [Upgrading](https://websideproject.com/docs/nuxt-auto/auto-api/upgrading)

An admin panel for these resources: [@websideproject/nuxt-auto-admin](https://npmjs.com/package/@websideproject/nuxt-auto-admin).

## Links

- [GitHub](https://github.com/websideproject/nuxt-auto)
- [Issues](https://github.com/websideproject/nuxt-auto/issues) · [Discussions](https://github.com/websideproject/nuxt-auto/discussions)
- [Releases](https://github.com/websideproject/nuxt-auto/releases)

## License

[MIT](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE)
