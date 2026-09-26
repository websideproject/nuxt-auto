// Dev-only typing for the package's own typecheck (not shipped — `files` is `dist`). Apps get the
// generated declaration from `addTypeTemplate` in module.ts.
declare module '#nuxt-auto-api-registry' {
  import type { ResourceRegistration } from '../src/runtime/types'

  export const registry: Record<string, ResourceRegistration>
  export function getResource(name: string): ResourceRegistration | undefined
  export function getAllResources(): ResourceRegistration[]
  export const resourceNames: string[]
}
