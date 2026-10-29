import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

// The root entry's types are `dist/module.d.mts`, not `dist/types.d.mts`. @nuxt/module-builder writes `types.d.mts`
// with every export marked `type` (`export { type createModuleImport, … }`), so a module's `module.ts` calling
// `createModuleImport(…)` or a plugin calling `defineAutoApiPlugin(…)` failed to typecheck (TS1362/TS1485), though
// both are values in `module.mjs`. `module.d.mts` declares them as values and re-exports the same types.
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

describe('package exports', () => {
  it('types the root entry with the declarations that export values as values', () => {
    expect(pkg.exports['.']).toEqual({ types: './dist/module.d.mts', import: './dist/module.mjs' })
  })
})
