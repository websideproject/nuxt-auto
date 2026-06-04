// Test stub for `nitropack/runtime`.
//
// Since `fix: add missing explicit imports`, several src utils/plugins do
// `import { useRuntimeConfig } from 'nitropack/runtime'` (and `defineNitroPlugin`). The real module
// transitively imports `#nitro-internal-virtual/storage`, a virtual module that only exists inside a
// nitro build — so importing ANY handler/util that touches it crashes under plain vitest. This stub is
// aliased in via `vitest.config.ts`.
//
// The explicit imports also SHADOW the global `useRuntimeConfig`/`defineNitroPlugin` that tests provide
// with `vi.stubGlobal(...)`. To keep those per-test stubs working, both symbols here DELEGATE to the
// matching global when a test has set one, and fall back to sane defaults otherwise.

export function useRuntimeConfig(...args: any[]): any {
  const g = (globalThis as any).useRuntimeConfig
  return typeof g === 'function' && g !== useRuntimeConfig ? g(...args) : {}
}

export function defineNitroPlugin(fn: any): any {
  const g = (globalThis as any).defineNitroPlugin
  return typeof g === 'function' && g !== defineNitroPlugin ? g(fn) : fn
}
