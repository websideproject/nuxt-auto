import { computed } from 'vue'

/**
 * Get resource configuration by name
 */
export function useAdminResource(resourceName: string) {
  const { getResource, isLoading: registryLoading } = useAdminRegistry()

  const resource = computed(() => getResource(resourceName))
  const isLoading = computed(() => registryLoading.value || !resource.value)

  return {
    resource,
    isLoading,
  }
}
