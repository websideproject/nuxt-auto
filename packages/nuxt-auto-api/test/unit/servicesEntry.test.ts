import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as services from '../../src/runtime/services'
import { provideService as fromPlugins, useService as useFromPlugins } from '../../src/runtime/plugins'

// `@websideproject/nuxt-auto-api/services`: the services with no server code, for code the browser runs too.
const src = (f: string) => readFileSync(new URL(`../../src/runtime/${f}`, import.meta.url), 'utf8')
// Every `import … from '…'` line that isn't `import type`.
const runtimeImports = (code: string) => code.split('\n')
  .filter(l => l.startsWith('import ') && !l.startsWith('import type ') && l.includes(' from \''))
  .map(l => l.slice(l.lastIndexOf(' from \'') + 7, -1).replace(/'$/, ''))

describe('the /services entry', () => {
  it('is in the package exports', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    expect(pkg.exports['./services']).toEqual({ types: './dist/runtime/services.d.ts', import: './dist/runtime/services.js' })
  })

  it('exports the service functions', () => {
    expect(Object.keys(services).sort()).toEqual(['getNitroApp', 'hasService', 'provideService', 'removeService', 'useService'])
  })

  it('imports no runtime code beyond the registry, which imports none', () => {
    expect(src('services.ts').match(/^export \{[^}]*\} from '([^']+)'/m)?.[1]).toBe('./server/plugins/pluginRegistry')
    expect(runtimeImports(src('server/plugins/pluginRegistry.ts'))).toEqual([])
  })

  it('shares one registry with the /plugins entry', () => {
    globalThis.__autoApiPluginRegistry = undefined
    fromPlugins('entry.test', 42)
    expect(services.useService('entry.test')).toBe(42)
    services.provideService('entry.test', 43)
    expect(useFromPlugins('entry.test')).toBe(43)
  })
})
