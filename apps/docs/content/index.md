---
seo:
  title: Nuxt Auto - Automatic API & Admin Panel from Drizzle Schemas
  description: Ship production-ready REST APIs and admin panels automatically generated from your Drizzle ORM schemas. Built for Nuxt with full TypeScript support.
---

::u-page-hero
#title
Build APIs & Admin Panels in Minutes

#description
Auto-generate type-safe REST APIs and beautiful admin interfaces directly from your Drizzle ORM schemas.

Stop writing boilerplate. Start building features.

#links
  :::u-button
  ---
  color: neutral
  size: xl
  to: /getting-started/introduction
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  icon: simple-icons-github
  size: xl
  to: https://github.com/websideproject/nuxt-auto
  variant: outline
  ---
  Star on GitHub
  :::
::

::u-page-section
#title
Two Powerful Modules

#features
  :::u-page-feature
  ---
  icon: i-lucide-database
  ---
  #title
  [Nuxt Auto API]{.text-primary}

  #description
  Automatically generate complete REST APIs from Drizzle schemas with built-in authorization, validation, pagination, multi-tenancy, and plugin system. Supports SQLite, Postgres, MySQL, D1, Turso, and PlanetScale.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layout-dashboard
  ---
  #title
  [Nuxt Auto Admin]{.text-primary}

  #description
  Beautiful admin panel generated from your Auto API resources. Full CRUD operations, permission-based access control, customizable forms with rich widgets, M2M relationship management, and dark mode support.
  :::
::

::u-page-section
#title
Auto API Features

#features
  :::u-page-feature
  ---
  icon: i-lucide-zap
  ---
  #title
  Zero Boilerplate

  #description
  Define your Drizzle schema and get complete CRUD endpoints automatically. No manual route creation or handler writing needed.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-shield-check
  ---
  #title
  Multi-Tier Authorization

  #description
  Operation-level, SQL-level list filters, object-level, and field-level authorization. Built-in support for Better Auth and custom auth solutions.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-git-branch
  ---
  #title
  Plugin System

  #description
  Extend the request pipeline with plugins for rate limiting, request metadata, caching, audit logs, webhooks, and more. Build your own custom plugins easily.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layers
  ---
  #title
  Multi-Database Support

  #description
  Works with SQLite, Postgres, MySQL, Cloudflare D1, Turso, and PlanetScale through Drizzle ORM's unified API.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-code-2
  ---
  #title
  Type-Safe Frontend

  #description
  Auto-imported composables with TanStack Query integration, typed with your row types (`useAutoApiList<Post>('posts')`).
  :::

  :::u-page-feature
  ---
  icon: i-lucide-puzzle
  ---
  #title
  Flexible & Extensible

  #description
  Custom endpoints, handler overrides, lifecycle hooks, validation with Zod, cursor & offset pagination, nested relations, and M2M relationships.
  :::
::

::u-page-section
#title
Auto Admin Features

#features
  :::u-page-feature
  ---
  icon: i-lucide-sparkles
  ---
  #title
  Auto-Generated UI

  #description
  List, detail, create, and edit pages generated automatically from your Auto API resources. Responsive design with dark mode support.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-form-input
  ---
  #title
  Rich Form Widgets

  #description
  Text, number, textarea, checkbox, select, date/time picker, password, relation select and multi-relation select — picked from each column's type.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-lock
  ---
  #title
  Permission System

  #description
  Resource-level CRUD permissions, flexible UI behavior (hide or disable), sidebar filtering, route protection middleware, and custom page permissions.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-link
  ---
  #title
  M2M Relations

  #description
  Junction table management with composite primary keys, atomic sync operations, independent save/load logic, and support for multiple M2M relations per resource.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-paintbrush
  ---
  #title
  Fully Customizable

  #description
  Custom title and logo, colors through Nuxt UI's app config, custom pages and actions, and per-resource configuration.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-cpu
  ---
  #title
  Built with Nuxt UI

  #description
  Leverages Nuxt UI components for beautiful, accessible, and highly customizable interface. Consistent design system out of the box.
  :::
::

::u-page-section
---
align: left
---

#title
Quick Example

#description
Here's how simple it is to get started with both modules

#default

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@websideproject/nuxt-auto-api',
    '@websideproject/nuxt-auto-admin',
  ],

  autoApi: {
    prefix: '/api',
  },

  autoAdmin: {
    prefix: '/admin',
    branding: {
      title: 'My Admin Panel',
    },
  },
})
```

```typescript
// server/database/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role', { enum: ['user', 'admin'] }).default('user'),
})
```

```typescript
// modules/base/index.ts — register the table as a resource
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { createModuleImport } from '@websideproject/nuxt-auto-api'

export default defineNuxtModule({
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    nuxt.hook('autoApi:registerSchema', (registry) => {
      registry.register('users', {
        schema: createModuleImport(resolve('../../server/database/schema'), 'users'),
        authorization: createModuleImport(resolve('./auth'), 'usersAuth'),
      })
    })
  },
})
```

```typescript
// modules/base/auth.ts — anything undeclared is refused
import type { ResourceAuthConfig } from '@websideproject/nuxt-auto-api'

export const usersAuth: ResourceAuthConfig = {
  permissions: { read: ctx => !!ctx.user, create: 'admin', update: 'admin', delete: 'admin' },
}
```

Add `'./modules/base'` to `modules` and initialize the database in a server plugin
([Quick Start](/getting-started/quick-start) has every step). Then you have:

- ✅ REST API at `/api/users` with full CRUD operations, refused to anyone your rules don't allow
- ✅ Admin panel at `/admin` with user management interface
- ✅ Frontend composables (`useAutoApiList`, `useAutoApiMutation`)

::u-button
---
color: primary
size: lg
to: /getting-started/installation
trailing-icon: i-lucide-arrow-right
---
Get Started Now
::
::
