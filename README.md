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

Schema-driven fullstack Nuxt with a reusable admin. Generate APIs and admin panels from your Drizzle schema with built-in authentication and authorization.

## 📦 Modules

This monorepo contains two complementary Nuxt modules:

### [@websideproject/nuxt-auto-api](./packages/nuxt-auto-api)
Schema-driven API generation from Drizzle schema with auth and authz.

### [@websideproject/nuxt-auto-admin](./packages/nuxt-auto-admin)
Auto-generated admin panel from Drizzle schema.

## ✨ Features

<!-- automd:file src=".github/snippets/features.md" -->

- 🎯 **Schema-Driven** - Generate API endpoints and admin UI from your Drizzle schema
- 🔐 **Auth & AuthZ Built-in** - Authentication and authorization out of the box
- 📦 **Reusable Admin Panel** - Auto-generated admin interface based on your schema
- 🚀 **Type-Safe** - Full TypeScript support with type inference from your schema

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
pnpm install

# Generate type stubs
pnpm run dev:prepare

# Start the playground
pnpm run dev

# Run tests
pnpm run test
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
