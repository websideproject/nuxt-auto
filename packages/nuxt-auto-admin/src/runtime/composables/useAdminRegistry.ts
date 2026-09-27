import { computed } from 'vue'
// @ts-expect-error - virtual module
import { registry as generated } from '#nuxt-auto-admin-registry'
import type { ResourceSchema } from '../types'

// Imported statically. A dynamic import() made the registry its own chunk, and Vite names that chunk after the virtual
// module's id, which holds the absolute build path: under a deep checkout the file name passed 255 bytes and the
// build failed (ENAMETOOLONG). Static, it is also there on the first navigation, when the route middleware looks a
// resource up; while a chunk loaded, the middleware found no resource and skipped the permission check.
const registry = generated as Record<string, ResourceSchema>

/**
 * Access the admin registry (all resources)
 */
export function useAdminRegistry() {
  const allResources = computed(() => {
    return Object.values(registry).sort((a, b) => (a.order || 0) - (b.order || 0))
  })

  const getResource = (name: string) => {
    return registry[name]
  }

  const getResourcesByGroup = computed(() => {
    const grouped: Record<string, ResourceSchema[]> = {}

    allResources.value.forEach((resource) => {
      const group = resource.group || 'Default'
      if (!grouped[group]) {
        grouped[group] = []
      }
      grouped[group].push(resource)
    })

    return grouped
  })

  return {
    registry: computed(() => registry),
    allResources,
    getResource,
    getResourcesByGroup,
    // Always false: the registry is part of the bundle. Kept for callers written when it loaded lazily.
    isLoading: computed(() => false),
  }
}
