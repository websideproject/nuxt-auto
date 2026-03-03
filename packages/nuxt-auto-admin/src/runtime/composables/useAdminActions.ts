import { useRouter } from 'vue-router'

// These composables are auto-imported from nuxt-auto-api when the module is used
declare function useAutoApiDelete(resource: string): any

/**
 * Common admin actions for resources
 */
export function useAdminActions(resourceName: string) {
  const router = useRouter()

  const { mutate: deleteResource, isPending: isDeleting } = useAutoApiDelete(resourceName)

  /**
   * Navigate to resource list
   */
  function goToList() {
    const config = useRuntimeConfig()
    const prefix = config.public.autoAdmin?.prefix || '/admin'
    router.push(`${prefix}/${resourceName}`)
  }

  /**
   * Navigate to resource detail
   */
  function goToDetail(id: string | number) {
    const config = useRuntimeConfig()
    const prefix = config.public.autoAdmin?.prefix || '/admin'
    router.push(`${prefix}/${resourceName}/${id}`)
  }

  /**
   * Navigate to create form
   */
  function goToCreate() {
    const config = useRuntimeConfig()
    const prefix = config.public.autoAdmin?.prefix || '/admin'
    router.push(`${prefix}/${resourceName}/new`)
  }

  /**
   * Navigate to edit form
   */
  function goToEdit(id: string | number) {
    const config = useRuntimeConfig()
    const prefix = config.public.autoAdmin?.prefix || '/admin'
    router.push(`${prefix}/${resourceName}/${id}/edit`)
  }

  /**
   * Delete a resource item
   */
  async function handleDelete(id: string | number, options?: { redirect?: boolean }) {
    return new Promise<void>((resolve, reject) => {
      deleteResource(id, {
        onSuccess: () => {
          if (options?.redirect) {
            goToList()
          }
          resolve()
        },
        onError: (error: any) => {
          console.error('Failed to delete:', error)
          reject(error)
        },
      })
    })
  }

  return {
    goToList,
    goToDetail,
    goToCreate,
    goToEdit,
    handleDelete,
    isDeleting,
  }
}
