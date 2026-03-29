# Setup & Configuration

## Module Installation

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@websideproject/nuxt-auto-api'],
  autoApi: {
    prefix: '/api',            // default
    database: {
      client: 'd1',            // see Database Adapters below
      url?: string,            // for non-serverless clients
    },
  },
})
```

---

## Full Module Options (`AutoApiOptions`)

```ts
interface AutoApiOptions {
  prefix?: string                      // URL prefix, default: '/api'

  database: {
    client: DatabaseEngine             // required
    url?: string
  }

  pagination?: {
    default?: 'offset' | 'cursor'      // default: 'offset'
    defaultLimit?: number              // default: 20
    maxLimit?: number                  // default: 100
  }

  authorization?: Record<string, ResourceAuthConfig>   // per-resource auth

  multiTenancy?: MultiTenancyConfig

  plugins?: string | AutoApiPlugin[]   // plugin paths or instances

  exclude?: string[]                   // resource names to skip
  include?: string[]                   // whitelist (exclusive with exclude)

  relations?: {
    maxDepth?: number                  // default: 3
    allowFieldSelection?: boolean      // default: true
    allowFiltering?: boolean           // default: true
    allowPagination?: boolean          // default: true
  }

  bulk?: {
    enabled?: boolean                  // default: true
    maxBatchSize?: number              // default: 100
    transactional?: boolean            // default: true
  }

  aggregations?: {
    enabled?: boolean                  // default: true
    allowGroupBy?: boolean             // default: true
    maxGroupByFields?: number          // default: 5
  }

  hooks?: Record<string, ResourceHooks>  // static hook registration

  hookConfig?: {
    errorHandling?: 'throw' | 'log'    // default: 'log'
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

---

## Database Adapters

```ts
type DatabaseEngine = 'better-sqlite3' | 'postgres' | 'mysql' | 'd1' | 'turso' | 'planetscale'
```

| Engine | Notes |
|--------|-------|
| `d1` | Cloudflare D1 (serverless SQLite) — no `url` needed |
| `better-sqlite3` | Local SQLite file — set `url` to file path |
| `postgres` | PostgreSQL via pg — set `url` to connection string |
| `mysql` | MySQL/MariaDB — set `url` to connection string |
| `turso` | Turso (libSQL) — set `url` to Turso DB URL |
| `planetscale` | PlanetScale serverless MySQL |

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
        // optional: per-resource authorization, validation, hooks
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
  tenantIdField?: 'organizationId',          // column name in tenant-scoped tables
  getTenantId?: async (event) => {           // how to extract tenant ID from request
    const user = await getUser(event)
    return user?.organizationId ?? null
  },
  scopedResources?: ['posts', 'tasks'] | '*', // which resources are tenant-scoped
  excludedResources?: ['users'],
  allowCrossTenantAccess?: (user) => user.roles?.includes('superadmin'),
  requireTenant?: true,                      // 403 if no tenant ID resolved
}
```

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
| `RateLimitPlugin` | Sliding-window rate limiting by IP/user |
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
| `CachePlugin` | In-memory list/get caching with auto-invalidation |
| `SearchPlugin` | Full-text-like SQL LIKE/ILIKE search |
| `FieldEncryptionPlugin` | AES-256-GCM encryption of sensitive fields |
| `ApiTokenPlugin` | API token management with Bearer auth and scopes |

```ts
import { BetterAuthPlugin, AuditLogPlugin } from '@websideproject/nuxt-auto-api/plugins'

autoApi: {
  plugins: [BetterAuthPlugin(), AuditLogPlugin({ ... })],
}
```
