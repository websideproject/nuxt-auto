# @websideproject/nuxt-auto-admin

[![npm version](https://img.shields.io/npm/v/@websideproject/nuxt-auto-admin?color=black)](https://npmjs.com/package/@websideproject/nuxt-auto-admin)
[![npm downloads](https://img.shields.io/npm/dm/@websideproject/nuxt-auto-admin?color=black)](https://npm.chart.dev/@websideproject/nuxt-auto-admin)
[![license](https://img.shields.io/github/license/websideproject/nuxt-auto?color=black)](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE)

An admin panel generated from your [@websideproject/nuxt-auto-api](https://npmjs.com/package/@websideproject/nuxt-auto-api)
resources, built on Nuxt UI. Every resource you register gets a list, detail, create and edit page, and each caller
sees exactly what the API allows them.

![The admin's list page for an Articles resource: search, filters, export, row selection and per-row actions](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/admin-list-1440.png)

- **Generated from the API registry** — sidebar, dashboard and resource pages, no per-resource code
- **Permission-aware** — buttons follow the API's rules, down to the row: Edit/Delete are disabled on records an
  `objectLevel` rule refuses
- **Forms from the schema** — a widget per column type, many-to-many cards for junction tables
- **List tools** — search, filters, pagination, bulk delete, CSV/JSON export
- **Extensible** — custom pages, custom actions, widgets, branding and theming, dark mode

## Install

```bash
npx nuxt module add @websideproject/nuxt-auto-admin
```

It needs `@websideproject/nuxt-auto-api` (set up with resources) and `@nuxt/ui`.

## Quick start

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@websideproject/nuxt-auto-api', // before the admin, so its resources are registered
    '@websideproject/nuxt-auto-admin',
  ],
  autoAdmin: {
    prefix: '/admin',
    branding: { title: 'My Admin Panel' },
  },
})
```

The admin pages use the `admin` layout, which Nuxt renders only inside `<NuxtLayout>`:

```vue
<!-- app/app.vue -->
<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

Open `/admin`. A resource without `authorization` refuses every request (the API is deny-by-default), so its
pages show "permission denied" until you declare who may do what.

## Screenshots

From the repo's playground, taken by its CI:

| | |
|---|---|
| ![The Filters popover: an Id range, a Title contains box, a Published select and a Created At date range](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/admin-list-filters-1440.png) | ![The view dialog for article #1: every field as a label and value, with Edit and Delete](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/admin-view-modal-1440.png) |
| **Filters** per column type | **View** in a dialog |
| ![Two rows selected and the bulk delete confirmation open](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/admin-bulk-delete-1440.png) | ![The list as a regular user: drafts hidden, Create and Delete disabled, Edit and Delete disabled in the row menu](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/admin-list-user-1440.png) |
| **Bulk delete** of the selected rows | **As a regular user**: only what the API allows |
| ![The edit form of article #1 with Categories and Tags many-to-many cards](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/admin-edit-1440.png) | ![The import dialog: upload a CSV, match its columns to fields, create the records](https://raw.githubusercontent.com/websideproject/nuxt-auto/main/apps/docs/public/screenshots/admin-import-1440.png) |
| **Edit** with many-to-many cards | **Import** from CSV |

## Documentation

Full documentation: [websideproject.com/docs/nuxt-auto](https://websideproject.com/docs/nuxt-auto/getting-started/introduction)

- [Getting started](https://websideproject.com/docs/nuxt-auto/auto-admin/getting-started)
- [Configuration & theming](https://websideproject.com/docs/nuxt-auto/auto-admin/configuration-theming) · [Resource configuration](https://websideproject.com/docs/nuxt-auto/auto-admin/resource-configuration) · [Form fields & widgets](https://websideproject.com/docs/nuxt-auto/auto-admin/form-fields-widgets)
- [Permissions](https://websideproject.com/docs/nuxt-auto/auto-admin/permissions) · [M2M relationships](https://websideproject.com/docs/nuxt-auto/auto-admin/m2m-relationships)
- [Custom pages](https://websideproject.com/docs/nuxt-auto/auto-admin/custom-pages) · [Custom actions](https://websideproject.com/docs/nuxt-auto/auto-admin/custom-actions) · [Composables](https://websideproject.com/docs/nuxt-auto/auto-admin/composables)
- The API it builds on: [@websideproject/nuxt-auto-api](https://websideproject.com/docs/nuxt-auto/auto-api/getting-started)

## Links

- [GitHub](https://github.com/websideproject/nuxt-auto)
- [Issues](https://github.com/websideproject/nuxt-auto/issues) · [Discussions](https://github.com/websideproject/nuxt-auto/discussions)
- [Releases](https://github.com/websideproject/nuxt-auto/releases)

## License

[MIT](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE)
