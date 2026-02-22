import { ref, computed } from 'vue'
import type { ResourceSchema } from '../types'

// Module-level cache (not serialized for SSR)
let registryCache: Record<string, ResourceSchema> | null = null
let registryPromise: Promise<any> | null = null

/**
 * Access the admin registry (all resources)
 */
export function useAdminRegistry() {
  const registry = ref<Record<string, ResourceSchema>>(registryCache || {})
  const isLoading = ref(!registryCache)

  // Lazy load registry on first use
  if (!registryCache && !registryPromise) {
    registryPromise =
      // @ts-ignore - virtual module
      import('#nuxt-auto-admin-registry')
        .then((mod) => {
          registryCache = mod.registry
          registry.value = mod.registry
          isLoading.value = false
          return mod.registry
        })
        .catch((err) => {
          console.error('[nuxt-auto-admin] Failed to load registry:', err)
          isLoading.value = false
        })
  } else if (registryPromise && !registryCache) {
    // Wait for existing promise
    registryPromise.then(() => {
      registry.value = registryCache || {}
      isLoading.value = false
    })
  }

  const allResources = computed(() => {
    return Object.values(registry.value).sort((a, b) => (a.order || 0) - (b.order || 0))
  })

  const getResource = (name: string) => {
    return registry.value[name]
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
    registry: computed(() => registry.value),
    allResources,
    getResource,
    getResourcesByGroup,
    isLoading: computed(() => isLoading.value),
  }
}
