// Test stub for the `#nuxt-auto-api-registry` virtual module (aliased in vitest.config.ts).
// `assertResourcePermission` / soft-delete batch utils dynamically import this to read each
// resource's authorization config. Tests set it via `setRegistry({...})`; empty by default so
// resolution denies (matching the real no-config behaviour: deny by default).

export const registry: Record<string, any> = {}

export function setRegistry(next: Record<string, any>): void {
  resetRegistry()
  Object.assign(registry, next)
}

export function resetRegistry(): void {
  for (const key of Object.keys(registry)) Reflect.deleteProperty(registry, key)
}
