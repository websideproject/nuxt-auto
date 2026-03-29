---
name: nuxt-auto-admin
description: Use when working with nuxt-auto-admin (@websideproject/nuxt-auto-admin) - auto-generated admin panel from Drizzle ORM schemas, with resource tables, forms, M2M cards, permission integration, and customizable widgets.
license: MIT
---

# nuxt-auto-admin

Auto-generates a full admin panel for Nuxt 4 from Drizzle ORM schemas registered with `@websideproject/nuxt-auto-api`. Introspects table schemas at build time to produce list views, create/edit forms, M2M management, and permission-aware navigation — all via `@nuxt/ui`.

**Requires** `@websideproject/nuxt-auto-api` loaded first in the `modules` array.

## When to Use

- Configuring `autoAdmin` module options (branding, prefix, features, permissions)
- Customizing resource display (`displayName`, `icon`, `listFields`, `formFields`, `hiddenFields`)
- Adding/configuring form field widgets (`WidgetType`, `WidgetOptions`)
- Writing custom actions (`CustomAction`) for single items, bulk, or page-level
- Using admin composables (`useAdminConfig`, `useAdminRegistry`, `useAdminPermissions`, `useAdminActions`)
- Working with `<ResourceTable>`, `<ResourceForm>`, `<AutoForm>`, `<M2MRelationCard>`, `<AutoField>`
- Setting up custom pages (`customPages`)
- Understanding permission integration with nuxt-auto-api

## Quick Start

```ts
// nuxt.config.ts — load API module first
export default defineNuxtConfig({
  modules: [
    '@websideproject/nuxt-auto-api',
    '@websideproject/nuxt-auto-admin',
  ],
  autoApi: {
    database: { client: 'd1' },
  },
  autoAdmin: {
    prefix: '/admin',
    access: (user) => user?.roles?.includes('admin'),
    branding: { title: 'My App Admin', logo: '/logo.svg' },
    resources: {
      posts: {
        displayName: 'Blog Posts',
        icon: 'i-heroicons-document-text',
        listFields: ['title', 'status', 'author', 'createdAt'],
        hiddenFields: ['slug', 'internalNotes'],
      },
      users: {
        displayName: 'Users',
        icon: 'i-heroicons-users',
        group: 'Team',
        readonlyFields: ['email', 'createdAt'],
      },
    },
  },
})
```

## Auto-Generated Routes

All prefixed by `autoAdmin.prefix` (default: `/admin`):

| Route | Page |
|-------|------|
| `/admin` | Dashboard |
| `/admin/:resource` | List with search, filters, bulk actions |
| `/admin/:resource/new` | Create form |
| `/admin/:resource/:id` | Detail view |
| `/admin/:resource/:id/edit` | Edit form |

## Available Guidance

| File | Topics |
|------|--------|
| **[references/config.md](references/config.md)** | ModuleOptions, ResourceConfig, DashboardConfig, ThemeConfig, CustomPageConfig |
| **[references/fields-widgets.md](references/fields-widgets.md)** | FieldConfig, all WidgetTypes with WidgetOptions, auto-widget selection rules |
| **[references/composables.md](references/composables.md)** | useAdminConfig, useAdminRegistry, useAdminResource, useAdminPermissions, useAdminActions, useResourceForm, useM2MDetection |
| **[references/components.md](references/components.md)** | ResourceTable, ResourceForm, AutoForm, AutoField, M2MRelationCard, modals |
| **[references/actions-permissions.md](references/actions-permissions.md)** | CustomAction, ActionContext, permission integration, middleware, unauthorized behavior |
| **[references/module-authoring.md](references/module-authoring.md)** | Injecting admin display config from a Nuxt module: spread pattern, formFields, junction tables |

## Progressive Loading

- Setting up the module or resources? → [references/config.md](references/config.md)
- Configuring form fields / widgets? → [references/fields-widgets.md](references/fields-widgets.md)
- Using composables in custom pages? → [references/composables.md](references/composables.md)
- Using admin UI components? → [references/components.md](references/components.md)
- Custom actions or permission control? → [references/actions-permissions.md](references/actions-permissions.md)
- Building a Nuxt module that ships admin config? → [references/module-authoring.md](references/module-authoring.md)

**DO NOT read all files at once.**

## Related Skills

- **`nuxt-auto-api`** — required backend; provides the endpoints this admin consumes
- **`nuxt-ui`** — UI component library used by the admin panel
- **`nuxt`** — Nuxt 4 patterns for custom pages and middleware

_Token efficiency: Main skill ~350 tokens. Each reference ~800–1200 tokens._
