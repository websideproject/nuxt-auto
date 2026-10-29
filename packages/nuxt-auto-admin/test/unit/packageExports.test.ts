import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

// The root entry's types are `dist/module.d.mts`, not `dist/types.d.mts`, as in nuxt-auto-api. @nuxt/module-builder
// writes `types.d.mts` with every export marked `type` (`export { type generateAdminRegistry, … }`), so calling one
// of the module's exported helpers (`generateAdminRegistry`, `assertNoAccessFunctions`, `adminApiInfo`, …) failed to
// typecheck (TS1362/TS1485), though they are values in `module.mjs`. `module.d.mts` declares them as values.
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

describe('package exports', () => {
  it('types the root entry with the declarations that export values as values', () => {
    expect(pkg.exports['.']).toEqual({ types: './dist/module.d.mts', import: './dist/module.mjs' })
  })
})
