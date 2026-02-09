# Module Template

> **⚠️ This is a template folder - DO NOT publish this package to npm**

This folder serves as a template for creating new modules in the Nuxt Auto monorepo.

## Quick Start

```bash
# Copy this template to create a new module
cp -r packages/module-template packages/nuxt-auto-YOUR_MODULE_NAME

# Then follow the instructions in MODULE_SETUP.md
```

## Documentation

See [MODULE_SETUP.md](./MODULE_SETUP.md) for detailed setup instructions.

## What's Included

- Pre-configured package.json with all necessary scripts
- Basic module structure with runtime plugin
- Test setup with fixtures
- TypeScript configuration
- Example module options interface

## Naming Convention

All modules in this monorepo follow this pattern:

- **Package name**: `@websideproject/nuxt-auto-{feature}`
- **Folder name**: `nuxt-auto-{feature}`
- **Module name**: `nuxt-auto-{feature}` (kebab-case)
- **Config key**: `auto{Feature}` (camelCase)

## Examples

Existing modules to reference:
- `nuxt-auto-api` - API generation module
- `nuxt-auto-admin` - Admin panel module
