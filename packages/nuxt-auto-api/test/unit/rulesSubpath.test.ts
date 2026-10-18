import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import * as rules from '../../src/runtime/server/rules.public'

// `@websideproject/nuxt-auto-api/rules` exists so app rules can be tested in plain Vitest. Walk its static import
// graph: nothing in it may import `nitropack/*` or a build-time virtual module (`#…`), which only load in Nitro.
const entry = fileURLToPath(new URL('../../src/runtime/server/rules.public.ts', import.meta.url))

function staticImports(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  // `import … from '…'`, `export … from '…'` and `import '…'` (type-only imports are erased; dynamic `import()` runs
  // only when called)
  return [...source.matchAll(/^(?:(?:import|export) (?!type )[^'"()]*? from |import )'([^']+)'/gm)].map(m => m[1]!)
}

function resolveLocal(from: string, spec: string): string {
  const base = resolve(dirname(from), spec)
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) if (existsSync(candidate)) return candidate
  throw new Error(`cannot resolve ${spec} from ${from}`)
}

function nitroImports(start: string): { offenders: string[], files: number } {
  const seen = new Set<string>()
  const offenders: string[] = []
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const spec of staticImports(file)) {
      if (spec.startsWith('nitropack') || spec.startsWith('#')) offenders.push(`${file.split('/src/')[1]} → ${spec}`)
      else if (spec.startsWith('.')) visit(resolveLocal(file, spec))
    }
  }
  visit(start)
  return { offenders, files: seen.size }
}

describe('@websideproject/nuxt-auto-api/rules', () => {
  it('imports nothing that needs Nitro', () => {
    const { offenders, files } = nitroImports(entry)
    expect(offenders).toEqual([])
    expect(files).toBeGreaterThan(5)
  })

  it('(the check finds what /utils pulls in)', () => {
    expect(nitroImports(fileURLToPath(new URL('../../src/runtime/server/utils.public.ts', import.meta.url))).offenders).not.toEqual([])
  })

  it('evaluates rules like the pipeline: undeclared is denied, * passes', async () => {
    const ctx = (permissions: string[]) => ({ user: { id: 1 }, permissions }) as any
    expect(await rules.evaluatePermission(undefined, ctx([]))).toBe(false)
    expect(await rules.evaluatePermission('posts:delete', ctx(['*']))).toBe(true)
    expect(await rules.checkPermission('restore', { permissions: { update: 'editor' } }, ctx(['editor']))).toBe(true)
  })
})
