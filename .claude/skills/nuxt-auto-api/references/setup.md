# Setup & Configuration

## Module Installation

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@websideproject/nuxt-auto-api'],
  autoApi: {
    prefix: '/api',            // default
  },
})
```

```ts
// server/plugins/database.ts — REQUIRED: hand auto-api the Drizzle instance and name the engine
import { drizzle } from 'drizzle-orm/d1'
import { initializeDatabase } from '@websideproject/nuxt-auto-api/database'
import * as schema from '../database/schema'

export default defineNitroPlugin(async () => {
  const env = await (globalThis as any).__env__          // cloudflare_module preset bindings
  initializeDatabase(drizzle(env.DB, { schema }), 'd1')  // the engine is set HERE, nowhere else
})
```

---

## Full Module Options (`AutoApiOptions`)

```ts
interface AutoApiOptions {
  prefix?: string                      // URL prefix, default: '/api'
  debug?: boolean                      // build-time registration logs

  pagination?: {
    defaultLimit?: number              // default: 20
    maxLimit?: number                  // default: 100 — also caps include and M2M pages
  }

  authorization?: Record<string, ResourceAuthConfig>   // app overrides (strings/arrays only — serialized)

  multiTenancy?: MultiTenancyConfig    // see references/advanced.md

  plugins?: string | AutoApiPlugin[]   // path to a server file exporting an array (recommended)

  relations?: {
    maxDepth?: number                  // default: 3
    maxIncludes?: number               // default: 20 relations per request
    allowFieldSelection?: boolean      // default: true
    allowFiltering?: boolean           // default: true
    allowPagination?: boolean          // default: true
  }

  bulk?: {
    enabled?: boolean                  // default: true
    maxBatchSize?: number              // default: 100
    transactional?: boolean            // default: true (not atomic on D1 — it reports data.committed)
  }

  aggregations?: {
    enabled?: boolean                  // default: true
    allowGroupBy?: boolean             // default: true
    maxGroupByFields?: number          // default: 5
  }

  hookConfig?: {
    errorHandling?: 'throw' | 'log'    // default: 'log' for after-hooks
    timeout?: number                   // ms, default: 5000
    parallel?: boolean                 // default: false
  }

  m2m?: M2MConfig

  hiddenFields?: {
    global?: string[]                  // fields hidden from ALL resources
    resources?: Record<string, string[]>
  }
}
```

Removed (fail the build): `hooks`, `exclude`, `include`, `multiTenancy.getTenantId/allowCrossTenantAccess/requireTenant`.
`database` is accepted but NOT read (deprecated) — the engine comes from `initializeDatabase`.

---

## Database Adapters

```ts
type DatabaseEngine = 'better-sqlite3' | 'postgres' | 'mysql' | 'd1' | 'turso' | 'planetscale'
```

| Engine | Notes |
|--------|-------|
| `d1` | Cloudflare D1 — **no transactions**: `atomic()` is not atomic (`supportsTransactions: false`) |
| `better-sqlite3` | Local SQLite — `atomic()` uses `BEGIN IMMEDIATE` |
| `postgres` | `db.transaction()` |
| `mysql` / `planetscale` | `db.transaction()`; no RETURNING — rows are read back (`insertReturning`) |
| `turso` | libSQL, `db.transaction()` |

---

## Resource Registration

Resources are registered at **build time** via the `autoApi:registerSchema` Nuxt hook. Typically done inside a Nuxt module or local module.

```ts
// modules/my-api/index.ts
import { defineNuxtModule, createResolver } from '@nuxt/kit'

export default defineNuxtModule({
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.hook('autoApi:registerSchema', (registry) => {
      // Register a resource from a Drizzle schema export
      registry.register('posts', {
        schema: createModuleImport(
          resolver.resolve('../../server/database/schema'),
          'posts'        // export name of the Drizzle table
        ),
        // authorization is effectively REQUIRED (deny by default); validation and hooks are optional
        authorization: createModuleImport(
          resolver.resolve('./authorization'),
          'postsAuth'
        ),
        hooks: createModuleImport(
          resolver.resolve('./hooks'),
          'postsHooks'
        ),
      })

      registry.register('users', {
        schema: createModuleImport(
          resolver.resolve('../../server/database/schema'),
          'users'
        ),
        // ⚠ no `authorization` → every request to /api/users is refused (deny by default; the build warns)
      })
    })
  },
})
```

The `registry.register(name, config)` call ties a resource name (used in API URLs) to a Drizzle table schema.

---

## Multi-Tenancy

```ts
multiTenancy: {
  enabled: true,
  tenantIdField?: 'organizationId',           // column name in tenant-scoped tables
  userTenantField?: 'organizationId',         // ctx.user property holding the active tenant (default: tenantIdField)
  scopedResources?: ['posts', 'tasks'] | '*', // which resources are tenant-scoped (must also have the column)
  excludedResources?: ['users'],
}
```

The tenant is resolved on the server only: `ctx.tenant` (context extender) → `event.context.tenantId` →
`ctx.user[userTenantField]`. No tenant on a scoped resource → 403 (fails closed). `getTenantId`,
`allowCrossTenantAccess`, `requireTenant` were removed (build error); cross-tenant staff get
`ctx.tenant.canAccessAllTenants = true` from a context extender. Details: references/advanced.md.

---

## Hidden Fields (Global)

```ts
hiddenFields: {
  global: ['password', 'passwordHash', 'secret'],   // never returned from any resource
  resources: {
    users: ['internalNotes', 'stripeSecretKey'],
  },
}
```

---

## Built-In Plugins

Import from `@websideproject/nuxt-auto-api/plugins`:

| Plugin | Purpose |
|--------|---------|
| `RateLimitPlugin` | Rate limiting by IP/user; pluggable store or Cloudflare RateLimit binding (`limiter`) |
| `RequestMetadataPlugin` | Extract IP, geo, user-agent into context + DB columns |
| `BetterAuthPlugin` | Session auth via better-auth |
| `AuditLogPlugin` | Record all mutations with before/after snapshots |
| `WebhookPlugin` | POST notifications on mutations |
| `ActivityFeedPlugin` | User-facing activity log |
| `SlugGenerationPlugin` | Auto-generate URL slugs from a source field |
| `SchemaValidationPlugin` | Runtime Zod/Valibot schema validation |
| `DataExportPlugin` | CSV/JSON export endpoints |
| `FileUploadPlugin` | File uploads tied to records |
| `RevisionHistoryPlugin` | Full version history with rollback |
| `CachePlugin` | list/get caching with auto-invalidation; pluggable store (in-memory / Cloudflare KV) |
| `SearchPlugin` | Full-text-like SQL LIKE/ILIKE search |
| `FieldEncryptionPlugin` | AES-256-GCM encryption of sensitive fields |
| `ApiTokenPlugin` | API token management with Bearer auth and scopes |

```ts
import { BetterAuthPlugin, AuditLogPlugin } from '@websideproject/nuxt-auto-api/plugins'

autoApi: {
  plugins: [BetterAuthPlugin(), AuditLogPlugin({ ... })],
}
```
