# Module Template - Setup Guide

This is a template for creating new modules in the Nuxt Auto monorepo. Follow the steps below to bootstrap a new module.

## Quick Start

```bash
# 1. Copy this template to create a new module
cp -r packages/module-template packages/nuxt-auto-YOUR_MODULE_NAME

# 2. Navigate to your new module
cd packages/nuxt-auto-YOUR_MODULE_NAME

# 3. Follow the "What to Replace" section below
```

## What to Replace

### 1. Package Name & Metadata

**File: `package.json`**

Replace these values:

```json
{
  "name": "@websideproject/nuxt-auto-MODULE_NAME",     // → "@websideproject/nuxt-auto-YOUR_MODULE_NAME"
  "description": "Your module description here",        // → Describe what your module does
}
```

**Example:**
```json
{
  "name": "@websideproject/nuxt-auto-forms",
  "description": "Auto-generated forms from Drizzle schema with validation",
}
```

### 2. Module Definition

**File: `src/module.ts`**

Update the module metadata:

```typescript
export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-auto-MODULE_NAME',    // → 'nuxt-auto-YOUR_MODULE_NAME'
    configKey: 'autoModuleName',      // → 'autoYourModuleName' (camelCase)
    docs: 'https://github.com/websideproject/nuxt-auto',
  },
  // ...
})
```

**Example:**
```typescript
export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-auto-forms',
    configKey: 'autoForms',
    docs: 'https://github.com/websideproject/nuxt-auto',
  },
  // ...
})
```

### 3. Module Options Interface

**File: `src/module.ts`**

Define your module's configuration options:

```typescript
export interface ModuleOptions {
  // Replace 'foo' with your actual options
  enabled?: boolean
  prefix?: string
  // Add your module-specific options here
}

export default defineNuxtModule<ModuleOptions>({
  defaults: {
    enabled: true,
    prefix: 'Auto'
  },
  // ...
})
```

### 4. Test Fixtures

**File: `test/fixtures/basic/nuxt.config.ts`**

Update the module import and config:

```typescript
export default defineNuxtConfig({
  modules: ['../../../src/module'],
  autoYourModuleName: {
    // Your test configuration
  }
})
```

**File: `test/fixtures/basic/package.json`**

Update the name:

```json
{
  "name": "nuxt-auto-YOUR_MODULE_NAME-playground",
  "private": true
}
```

## Where to Add Your Code

### Runtime Code (Client/Server)

Add your runtime code in `src/runtime/`:

```
src/runtime/
├── composables/       # Vue composables (auto-imported in Nuxt apps)
│   └── useYourFeature.ts
├── components/        # Vue components (auto-imported in Nuxt apps)
│   └── YourComponent.vue
├── plugins/          # Nuxt plugins
│   └── plugin.ts
└── server/           # Server-side code
    ├── api/          # API routes
    └── middleware/   # Server middleware
```

### Adding Composables

**File: `src/module.ts`**

```typescript
import { addImports } from '@nuxt/kit'

export default defineNuxtModule<ModuleOptions>({
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Add auto-imported composables
    addImports({
      name: 'useYourFeature',
      from: resolver.resolve('./runtime/composables/useYourFeature')
    })
  }
})
```

### Adding Components

**File: `src/module.ts`**

```typescript
import { addComponent } from '@nuxt/kit'

export default defineNuxtModule<ModuleOptions>({
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Add auto-imported components
    addComponent({
      name: 'YourComponent',
      filePath: resolver.resolve('./runtime/components/YourComponent.vue')
    })
  }
})
```

### Adding Server Routes

**File: `src/module.ts`**

```typescript
import { addServerHandler } from '@nuxt/kit'

export default defineNuxtModule<ModuleOptions>({
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Add server API routes
    addServerHandler({
      route: '/api/your-endpoint',
      handler: resolver.resolve('./runtime/server/api/your-endpoint')
    })
  }
})
```

## Updating Root Configuration

### 1. Add to Playground

**File: `apps/playground/package.json`**

```json
{
  "dependencies": {
    "@websideproject/nuxt-auto-YOUR_MODULE_NAME": "workspace:*"
  }
}
```

**File: `apps/playground/nuxt.config.ts`**

```typescript
export default defineNuxtConfig({
  modules: [
    '@websideproject/nuxt-auto-api',
    '@websideproject/nuxt-auto-admin',
    '@websideproject/nuxt-auto-YOUR_MODULE_NAME'  // Add your module
  ],
  autoYourModuleName: {
    // Your module config for testing
  }
})
```

### 2. Add Build Script (Optional)

**File: `package.json` (root)**

```json
{
  "scripts": {
    "build:YOUR_MODULE_NAME": "turbo run build --filter=@websideproject/nuxt-auto-YOUR_MODULE_NAME"
  }
}
```

### 3. Update Release Workflow

**File: `.github/workflows/release.yml`**

Add your module to the publish steps:

```yaml
- name: Publish nuxt-auto-YOUR_MODULE_NAME to npm
  run: cd packages/nuxt-auto-YOUR_MODULE_NAME && npm publish --provenance --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Commands

```bash
# Install dependencies (from root)
bun install

# Prepare your module for development (generates types)
cd packages/nuxt-auto-YOUR_MODULE_NAME
bun run dev:prepare

# Or from root
bun run dev:prepare

# Test in playground (from root)
bun run dev

# Build your module
bun run build

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Lint
bun run lint
bun run lint:fix

# Type check
bun run typecheck
```

## Testing Your Module

### Unit Tests

Create tests in `test/`:

```typescript
// test/basic.test.ts
import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { setup, $fetch } from '@nuxt/test-utils'

describe('nuxt-auto-YOUR_MODULE_NAME', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('should work', async () => {
    // Your tests here
  })
})
```

### Manual Testing in Playground

1. Start the playground: `bun run dev`
2. Test your module features in `apps/playground/app.vue`
3. Check server logs and browser console

## Module Structure Reference

```
packages/nuxt-auto-YOUR_MODULE_NAME/
├── src/
│   ├── module.ts              # Main module definition
│   └── runtime/
│       ├── plugin.ts          # Plugin initialization
│       ├── composables/       # Vue composables
│       ├── components/        # Vue components
│       └── server/            # Server-side code
├── test/
│   ├── basic.test.ts          # Unit tests
│   └── fixtures/
│       └── basic/             # Test fixture app
│           ├── app.vue
│           ├── nuxt.config.ts
│           └── package.json
├── package.json               # Module package configuration
└── MODULE_SETUP.md           # This file
```

## Quick Reference: Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Package name | `@websideproject/nuxt-auto-{name}` | `@websideproject/nuxt-auto-forms` |
| Module name | `nuxt-auto-{name}` (kebab-case) | `nuxt-auto-forms` |
| Config key | `auto{Name}` (camelCase) | `autoForms` |
| Folder name | `nuxt-auto-{name}` | `nuxt-auto-forms` |

## Tips

1. **Keep it simple**: Start with the basics, add complexity as needed
2. **Test early**: Write tests as you develop features
3. **Document**: Update README and docs as you add features
4. **Follow patterns**: Look at existing modules (nuxt-auto-api, nuxt-auto-admin) for patterns
5. **Type safety**: Leverage TypeScript for better DX
6. **Runtime vs Build**: Understand what runs at build time vs runtime
   - `src/module.ts`: Runs at build time
   - `src/runtime/*`: Runs in the Nuxt app (runtime)

## Common Tasks

### Add a new composable

1. Create `src/runtime/composables/useYourFeature.ts`
2. Register it in `src/module.ts` with `addImports()`
3. Test it in playground: `const { yourFeature } = useYourFeature()`

### Add a new component

1. Create `src/runtime/components/YourComponent.vue`
2. Register it in `src/module.ts` with `addComponent()`
3. Use it in playground: `<YourComponent />`

### Add a server route

1. Create `src/runtime/server/api/your-endpoint.ts`
2. Register it in `src/module.ts` with `addServerHandler()`
3. Test it: `$fetch('/api/your-endpoint')`

## Next Steps

1. Copy this template: `cp -r packages/module-template packages/nuxt-auto-YOUR_MODULE_NAME`
2. Replace all placeholders (search for `MODULE_NAME`, `moduleName`, etc.)
3. Update `package.json` and `src/module.ts`
4. Add to playground for testing
5. Start building your module features
6. Write tests
7. Update documentation

## Resources

- [Nuxt Module Author Guide](https://nuxt.com/docs/guide/going-further/modules)
- [Nuxt Kit Documentation](https://nuxt.com/docs/api/kit)
- [Module Template Repository](https://github.com/nuxt/module-template)
