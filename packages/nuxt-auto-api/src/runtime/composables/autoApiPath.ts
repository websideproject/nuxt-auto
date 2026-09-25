import { useRuntimeConfig } from '#app'

/**
 * Builds URLs under the configured `autoApi.prefix` (default `/api`), encoding every segment.
 *
 * @example
 * const path = useAutoApiPath()
 * path('posts', 12, 'relations', 'tags') // → '/api/posts/12/relations/tags'
 */
export function useAutoApiPath(): (...segments: Array<string | number>) => string {
  let prefix = '/api'
  try {
    prefix = (useRuntimeConfig().public as any)?.autoApi?.prefix || '/api'
  }
  catch {
    // outside a Nuxt context (unit tests) — keep the default
  }
  const base = prefix.replace(/\/+$/, '')
  return (...segments) => `${base}/${segments.map(s => encodeURIComponent(String(s))).join('/')}`
}
