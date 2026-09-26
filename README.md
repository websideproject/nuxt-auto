# Nuxt Auto

**@websideproject/nuxt-auto-api**

<!-- automd:badges color="black" name="@websideproject/nuxt-auto-api" -->

[![npm version](https://img.shields.io/npm/v/@websideproject/nuxt-auto-api?color=black)](https://npmjs.com/package/@websideproject/nuxt-auto-api)
[![npm downloads](https://img.shields.io/npm/dm/@websideproject/nuxt-auto-api?color=black)](https://npm.chart.dev/@websideproject/nuxt-auto-api)

<!-- /automd -->

**@websideproject/nuxt-auto-admin**

<!-- automd:badges color="black" name="@websideproject/nuxt-auto-admin" -->

[![npm version](https://img.shields.io/npm/v/@websideproject/nuxt-auto-admin?color=black)](https://npmjs.com/package/@websideproject/nuxt-auto-admin)
[![npm downloads](https://img.shields.io/npm/dm/@websideproject/nuxt-auto-admin?color=black)](https://npm.chart.dev/@websideproject/nuxt-auto-admin)

<!-- /automd -->

[![license](https://img.shields.io/github/license/websideproject/nuxt-auto?color=black)](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE)

Secure REST APIs and an admin panel for Nuxt, generated from your Drizzle schema — deny-by-default authorization, multi-tenancy, validation and typed TanStack Query composables.

## 📦 Modules

This monorepo contains two complementary Nuxt modules:

### [@websideproject/nuxt-auto-api](./packages/nuxt-auto-api)
Secure REST APIs from your Drizzle schema: deny-by-default authorization, multi-tenancy, soft delete, M2M, bulk and aggregations, with TanStack Query composables.

### [@websideproject/nuxt-auto-admin](./packages/nuxt-auto-admin)
Auto-generated admin panel from Drizzle schema.

## ✨ Features

<!-- automd:file src=".github/snippets/features.md" -->

- 🎯 **Schema-driven** - CRUD, filtering, sorting, pagination, nested relations, bulk, aggregations and many-to-many from your Drizzle tables
- 🔐 **Secure by default** - every operation is denied until you declare who may do it; row visibility (tenant, `listFilter`, `objectLevel`) applies to every route; server-owned columns can't be written from a request
- 🏢 **Multi-tenant** - organization scoping resolved on the server and failing closed, ready for better-auth organizations
- 🧩 **Bring your own auth** - a better-auth plugin is included; any session works through a context extender
- ⚡ **Typed, SSR-aware composables** - TanStack Query with cache invalidation, optimistic updates and permission checks for the UI
- 🗄️ **Any Drizzle engine** - SQLite, Cloudflare D1, Turso, Postgres, MySQL and PlanetScale
- 📦 **Admin panel** - generated from the same resources with `@websideproject/nuxt-auto-admin`

<!-- /automd -->

## 🚀 Installation

<!-- automd:file src=".github/snippets/installation.md" -->

Install the modules you need:

```bash
# Install API module
npx nuxt module add @websideproject/nuxt-auto-api

# Install Admin module
npx nuxt module add @websideproject/nuxt-auto-admin

# Or both
npx nuxt module add @websideproject/nuxt-auto-api @websideproject/nuxt-auto-admin
```

Or install manually:

```bash
# npm
npm install -D @websideproject/nuxt-auto-api @websideproject/nuxt-auto-admin

# yarn
yarn add -D @websideproject/nuxt-auto-api @websideproject/nuxt-auto-admin

# pnpm
pnpm add -D @websideproject/nuxt-auto-api @websideproject/nuxt-auto-admin

# bun
bun add -D @websideproject/nuxt-auto-api @websideproject/nuxt-auto-admin
```

<!-- /automd -->

## 📖 Documentation

📖 **[Full Documentation →](https://github.com/websideproject/nuxt-auto)**

## 🤖 Claude Code Skills

If you use [Claude Code](https://claude.ai/code), install the skill plugin to give Claude accurate knowledge of both `nuxt-auto-api` and `nuxt-auto-admin` APIs.

```bash
/plugin marketplace add websideproject/nuxt-auto
/plugin install nuxt-auto-skills
```

The plugin provides two skills:
- **`nuxt-auto-api`** — resource registration, CRUD composables, authorization, hooks, bulk ops, M2M, aggregation, plugins, multi-tenancy, and module authoring patterns
- **`nuxt-auto-admin`** — admin config, resource display, form field widgets, custom actions, permissions, composables, and module authoring patterns

## 🔍 PR Previews

<!-- automd:file src=".github/snippets/pr-preview.md" -->

Every pull request publishes a preview package via [pkg.pr.new](https://pkg.pr.new), so you can install and test changes before they are merged.

```bash
# npm
npm install https://pkg.pr.new/@websideproject/nuxt-auto-api@<pr-number>
npm install https://pkg.pr.new/@websideproject/nuxt-auto-admin@<pr-number>

# pnpm
pnpm add https://pkg.pr.new/@websideproject/nuxt-auto-api@<pr-number>
pnpm add https://pkg.pr.new/@websideproject/nuxt-auto-admin@<pr-number>

# bun
bun add https://pkg.pr.new/@websideproject/nuxt-auto-api@<pr-number>
bun add https://pkg.pr.new/@websideproject/nuxt-auto-admin@<pr-number>
```

<!-- /automd -->

## 🤝 Contributing

<!-- automd:file src=".github/snippets/contributing.md" -->

Contributions are welcome! Feel free to open an issue or submit a pull request.

```bash
# Install dependencies
bun install

# Generate type stubs
bun run dev:prepare

# Start the playground
bun run dev

# Run tests
bun run test
```

The engine conformance suite (`packages/nuxt-auto-api/test/engines`) runs the same requests on SQLite, libsql
and D1 (Miniflare) every time, and on Postgres, MySQL and PlanetScale when you point it at them:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=autoapi postgres:17-alpine
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE=autoapi mysql:8.4 --max-connections=2000
docker run -d --network host ghcr.io/mattrobenolt/ps-http-sim:latest -listen-port=3900 -mysql-dbname=autoapi

AUTOAPI_TEST_PG_URL=postgres://postgres:test@localhost:5432/autoapi \
AUTOAPI_TEST_MYSQL_URL=mysql://root:test@localhost:3306/autoapi \
AUTOAPI_TEST_PLANETSCALE_URL=http://root:test@localhost:3900 \
bun run test
```

<!-- /automd -->

## ❓ Questions & Support

<!-- automd:file src=".github/snippets/support.md" -->

- **Issues**: [Open an issue](https://github.com/websideproject/nuxt-auto/issues) for bugs or feature requests
- **Discussions**: [Join the discussion](https://github.com/websideproject/nuxt-auto/discussions) for questions and ideas

<!-- /automd -->

## 📄 License

<!-- automd:file src=".github/snippets/license.md" -->

Published under the [MIT](https://github.com/websideproject/nuxt-auto/blob/main/LICENSE) license.

Made by [@bgervan](https://github.com/bgervan) and [community](https://github.com/websideproject/nuxt-auto/graphs/contributors) 💛

<a href="https://github.com/websideproject/nuxt-auto/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=websideproject/nuxt-auto" />
</a>

<!-- /automd -->
