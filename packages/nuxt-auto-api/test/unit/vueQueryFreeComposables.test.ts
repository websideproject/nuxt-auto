import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { VUE_QUERY_FREE_COMPOSABLES } from '../../src/runtime/vueQueryFreeComposables'

const composablesDir = fileURLToPath(new URL('../../src/runtime/composables/', import.meta.url))

/** Every file a module loads at runtime, following relative imports (type-only imports are erased). */
function runtimeClosure(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen
  seen.add(file)
  const source = readFileSync(file, 'utf8')
  for (const [, specifier] of source.matchAll(/^import (?!type )[^'"]*['"]([^'"]+)['"]/gm)) {
    if (!specifier!.startsWith('.')) continue
    const target = [`${specifier}.ts`, `${specifier}/index.ts`].map(s => resolve(dirname(file), s)).find(existsSync)
    if (target) runtimeClosure(target, seen)
  }
  return seen
}

// With `vueQuery: false` these are the only client auto-imports — and @tanstack/vue-query may not be installed.
describe('composables auto-imported without vue-query', () => {
  for (const { name, file } of VUE_QUERY_FREE_COMPOSABLES) {
    it(`${name} exists and loads nothing from @tanstack/vue-query`, () => {
      const path = resolve(composablesDir, `${file}.ts`)
      expect(readFileSync(path, 'utf8')).toMatch(new RegExp(`^export (function|const) ${name}\\b`, 'm'))
      for (const loaded of runtimeClosure(path)) {
        expect(readFileSync(loaded, 'utf8'), loaded).not.toMatch(/^import (?!type )[^'"]*['"]@tanstack\//m)
      }
    })
  }
})
