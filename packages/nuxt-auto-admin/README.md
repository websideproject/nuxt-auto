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

## Documentation

- [Getting started](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/1.getting-started.md)
- [Configuration & theming](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/2.configuration-theming.md) · [Resource configuration](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/3.resource-configuration.md) · [Form fields & widgets](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/4.form-fields-widgets.md)
- [Permissions](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/5.permissions.md) · [M2M relationships](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/7.m2m-relationships.md)
- [Custom pages](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/6.custom-pages.md) · [Custom actions](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/8.custom-actions.md) · [Composables](https://github.com/websideproject/nuxt-auto/blob/main/apps/docs/content/3.auto-admin/9.composables.md)
- The API it builds on: [@websideproject/nuxt-auto-api](https://github.com/websideproject/nuxt-auto/tree/main/packages/nuxt-auto-api#readme)

## Links

- [GitHub](https://github.com/websideproject/nuxt-auto)
- [Issues](https://github.com/websideproject/nuxt-auto/issues) · [Discussions](https://github.com/websideproject/nuxt-auto/discussions)
- [Releases](https://github.com/websideproject/nuxt-auto/releases)

## License

[MIT](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE)
