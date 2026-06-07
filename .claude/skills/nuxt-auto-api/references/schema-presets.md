# Schema Presets (Cross-engine)

## When to use

Use when writing or reviewing Drizzle schema files for nuxt-auto-api modules. Presets replace hand-rolled `createdAt`/`updatedAt`/`deletedAt`/`organizationId` columns with one-line imports — and *importing a preset activates the corresponding auto-api feature automatically* (soft-delete, timestamps, tenant scoping, audit stamping).

## Import — pick the dialect

```ts
// SQLite (better-sqlite3 / D1 / Turso)
import { id, timestamps, tenant, softDelete, audit, liveUnique, json } from '@websideproject/nuxt-auto-api/schema/sqlite'
// Postgres
import { id, timestamps, tenant, softDelete, audit, liveUnique, json } from '@websideproject/nuxt-auto-api/schema/pg'
// MySQL / PlanetScale
import { id, timestamps, tenant, softDelete, audit, json, liveUnique } from '@websideproject/nuxt-auto-api/schema/mysql'
```

## Full example (SQLite)

```ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { id, timestamps, tenant, softDelete, audit, liveUnique } from '@websideproject/nuxt-auto-api/schema/sqlite'

const sd = softDelete()   // { columns, indexes(t) }

export const articles = sqliteTable('articles', {
  ...id(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  ...tenant(),
  ...timestamps(),
  ...audit(),
  ...sd.columns,
}, t => [
  ...sd.indexes(t),
  ...tenant.indexes(t),
  liveUnique(t, t.slug, 'articles_slug_live'),
])
```

## Preset → auto-api feature map

| Preset | Auto-api behavior activated |
|---|---|
| `timestamps()` | `updatedAt` auto-refreshes |
| `softDelete()` | Soft-delete pipeline (list hide, restore, purge, cascade, trash) |
| `tenant()` | Tenant scoping |
| `audit()` | `createdBy`/`updatedBy` from request user (audit-stamp plugin, column-detected) |
| `liveUnique(t, col, name)` | Partial unique index — only among live (non-deleted) rows |

## `softDelete()` options

```ts
softDelete({ by: true, batch: true, reason: true })
// by=true → deletedBy (userId), batch=true → deletionId (batch hash), reason=true → deletedReason
// All default to true
```

## Cross-engine differences

- **UUID PK**: text on SQLite, uuid() on PG, varchar(36) on MySQL
- **Timestamps**: integer(mode:timestamp) / timestamp({withTimezone}) / datetime
- **JSON**: text(mode:json) / jsonb / json
- **liveUnique**: `WHERE` clause on SQLite/PG; MySQL has no partial indexes → use `liveUniqueMysql()` + manual migration

## Rules

- Spread `sd.columns` into the table body; call `sd.indexes(t)` in the indexes array.
- `tenant.indexes(t)` is called in the indexes array (not the columns spread).
- `liveUnique` returns a single index object; add it to the indexes array.
- Safe to use in registry-loaded `schema.ts` files (package subpath — OK for the registry loader).
