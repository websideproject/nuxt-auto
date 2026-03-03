import { useQueryClient } from '@tanstack/vue-query'

interface DemoUser {
  id: number
  name: string
  email: string
  role: string
}

interface SessionResponse {
  user: DemoUser | null
}

/**
 * Demo authentication composable
 * Manages session state and role switching for interactive demo
 */
export function useAuth() {
  const queryClient = useQueryClient()
  const user = useState<DemoUser | null>('demo-user', () => null)
  const isLoading = useState<boolean>('demo-user-loading', () => false)

  // Computed properties for role checking
  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isEditor = computed(() => user.value?.role === 'editor')
  const isUser = computed(() => user.value?.role === 'user')
  const role = computed(() => user.value?.role || 'anonymous')

  /**
   * Fetch current session from server
   */
  async function fetchSession() {
    isLoading.value = true
    try {
      const response = await $fetch<SessionResponse>('/api/demo/session')
      user.value = response.user
    }
    catch (error) {
      console.error('[useAuth] Failed to fetch session:', error)
      user.value = null
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Switch to a different role
   * Invalidates all queries to refetch with new permissions
   */
  async function switchRole(newRole: 'admin' | 'editor' | 'user' | 'anonymous') {
    isLoading.value = true
    try {
      const response = await $fetch<SessionResponse>('/api/demo/session', {
        method: 'POST',
        body: { role: newRole },
      })

      user.value = response.user

      // Invalidate all queries to refetch with new permissions
      await queryClient.invalidateQueries()

      console.log('[useAuth] Switched to role:', newRole)
    }
    catch (error) {
      console.error('[useAuth] Failed to switch role:', error)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Logout (clear session)
   */
  async function logout() {
    isLoading.value = true
    try {
      await $fetch('/api/demo/session', { method: 'DELETE' })
      user.value = null

      // Invalidate all queries
      await queryClient.invalidateQueries()

      console.log('[useAuth] Logged out')
    }
    catch (error) {
      console.error('[useAuth] Failed to logout:', error)
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    isAuthenticated,
    isAdmin,
    isEditor,
    isUser,
    role,
    fetchSession,
    switchRole,
    logout,
  }
}
