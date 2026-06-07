// Test stub for the `#nuxt-auto-api-registry` virtual module (aliased in vitest.config.ts).
// `assertResourcePermission` / soft-delete batch utils dynamically import this to read each
// resource's authorization config. Tests set it via `setRegistry({...})`; empty by default so
// resolution falls back to the safe `'admin'` defaults (matching the real no-config behaviour).

export let registry: Record<string, any> = {}

export function setRegistry(next: Record<string, any>): void {
  registry = next
}

export function resetRegistry(): void {
  registry = {}
}
